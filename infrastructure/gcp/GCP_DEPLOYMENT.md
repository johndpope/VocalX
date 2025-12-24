# GCP MVP Deployment (Compute Engine): Webapp + MongoDB + GPU Worker (Minimal, 1 user)

This guide deploys VocalX as two services on Google Cloud Platform:

- **Webapp VM (CPU)**: Next.js app (`apps/webapp`) on a small Compute Engine instance.
- **MongoDB (self-hosted on GCP)**: hosted by you on the same webapp VM (simplest) or on a tiny separate VM.
- **Worker VM (GPU)**: GPU-backed model server (SAM Audio) on a separate Compute Engine instance.

The webapp calls the worker over HTTPS using `WORKER_URL` and (optionally) `WORKER_API_KEY`.

> **Why 2 VMs for MVP**: it’s the fastest path to get a working deployment without wrestling with Cloud Run GPU quotas, complex build pipelines, or mixed dependencies.
>
> **Non-technical note**: You will mostly copy/paste commands. If anything fails, copy the error and send it to me.

---

## 0) Create project + enable APIs

### In the GCP Console (click-by-click)
1. Go to the Google Cloud Console.
2. Top bar → project dropdown → **New Project**.
3. Name: `vocalx-mvp` (or anything).
4. Click **Create**.

### Enable APIs (copy/paste in Cloud Shell)
1. In the Console, click the **terminal icon** (Cloud Shell) near the top right.
2. Run:

In Cloud Shell:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable compute.googleapis.com logging.googleapis.com
```

---

## 1) Decide your “minimal” architecture (recommended)

### Option A (minimal, recommended): MongoDB on the same Webapp VM
- Cheapest and easiest.
- MongoDB is **not** exposed to the internet (only localhost).
- Works for a single user MVP.

### Option B: MongoDB on a separate tiny VM
- Slightly more complex.
- Still minimal, but adds another VM.

This guide will show **Option A**, and at the end we note what changes for Option B.

---

## 2) Networking (firewall rules)

We will expose:
- Webapp: **80/443** (browser access)
- Worker: **443** (only you / or only the webapp)

### 2.1 Webapp firewall (HTTP/HTTPS)
Allow TCP 80/443 to the webapp VM:

```bash
gcloud compute firewall-rules create vocalx-web-allow-http \
  --allow tcp:80,tcp:443 \
  --direction INGRESS \
  --target-tags vocalx-web \
  --source-ranges 0.0.0.0/0
```

### 2.2 Worker firewall (HTTPS only; lock down)
For MVP, expose the worker only to **your IP** (most secure for a single user).

1. Find your public IP by searching “what is my ip”.
2. Replace `YOUR_PUBLIC_IP` below:

```bash
gcloud compute firewall-rules create vocalx-worker-allow-https \
  --allow tcp:443 \
  --direction INGRESS \
  --target-tags vocalx-worker \
  --source-ranges YOUR_PUBLIC_IP/32
```

---

## 3) Create the Webapp VM (CPU) (and host MongoDB on it)

### Recommended machine type (minimal)
- **`e2-small`** (2 vCPU, 2 GB RAM) can work for 1 user, but may be tight during builds.
- **`e2-medium`** (2 vCPU, 4 GB RAM) is the safer “minimal” choice.

We’ll use `e2-medium` and Ubuntu 22.04.

```bash
gcloud compute instances create vocalx-webapp \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=vocalx-web \
  --boot-disk-size=50GB
```

SSH in:

```bash
gcloud compute ssh vocalx-webapp --zone=us-central1-a
```

### 3.1 Install Node 20 + build tools

```bash
sudo apt-get update -y
sudo apt-get install -y curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

### 3.2 Install MongoDB (self-hosted, not Atlas)

We will:
- install MongoDB
- keep it bound to **localhost only** (not exposed publicly)
- enable authentication

#### Install MongoDB (Ubuntu 22.04 “jammy”)

```bash
sudo apt-get install -y gnupg
wget -qO - https://pgp.mongodb.com/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update -y
sudo apt-get install -y mongodb-org
```

Start MongoDB:

```bash
sudo systemctl enable --now mongod
sudo systemctl status mongod --no-pager
```

#### Secure MongoDB (single-user setup)
Edit MongoDB config:

```bash
sudo nano /etc/mongod.conf
```

Make sure you have:
- `bindIp: 127.0.0.1`
- enable authorization:

Add (or ensure) this section exists:

```yaml
security:
  authorization: enabled
```

Restart MongoDB:

```bash
sudo systemctl restart mongod
```

Create an admin user (Mongo shell):

```bash
mongosh
```

Inside the shell:

```javascript
use admin
db.createUser({user: "vocalxadmin", pwd: "REPLACE_WITH_A_LONG_PASSWORD", roles: [{role: "root", db: "admin"}]})
exit
```

Now your app will connect using a URL like:

```text
mongodb://vocalxadmin:REPLACE_WITH_A_LONG_PASSWORD@127.0.0.1:27017/vocalx?authSource=admin
```

> **Important**: MongoDB is only reachable from inside the VM because it binds to `127.0.0.1`. This is good for your 1-user MVP.

### 3.3 Deploy the webapp

Option A (simple): `git clone` your repo.

```bash
git clone YOUR_REPO_URL VocalX
cd VocalX/apps/webapp
npm install
npm run build
```

Create `.env.local` on the webapp VM:

```bash
cat > .env.local << 'EOF'
NODE_ENV=production
NEXTAUTH_URL=https://YOUR_DOMAIN_OR_IP
NEXTAUTH_SECRET=REPLACE_ME

# MongoDB (self-hosted on this same VM)
MONGO_URL=mongodb://vocalxadmin:REPLACE_WITH_A_LONG_PASSWORD@127.0.0.1:27017/vocalx?authSource=admin
MONGO_DB_NAME=vocalx

# Worker
WORKER_URL=https://YOUR_WORKER_DOMAIN_OR_IP
WORKER_API_KEY=REPLACE_ME
EOF
```

Start:

```bash
npm run start -- -p 3001
```

For MVP, you can keep it running with `tmux`, or use `pm2` / `systemd` for a stable service.

---

## 4) Create the Worker VM (GPU)

Pick a GPU type that’s available in your region. For MVP, start with a single GPU instance.

### Recommended GPU types (minimal)
Pick the cheapest available in your region:
- **T4** (older, usually cheaper; good MVP)
- **L4** (newer, faster; often more expensive)

#### Option 1: L4 (G2 family) (if available)

```bash
gcloud compute instances create vocalx-worker \
  --zone=us-central1-a \
  --machine-type=g2-standard-8 \
  --accelerator=type=nvidia-l4,count=1 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=vocalx-worker \
  --boot-disk-size=200GB \
  --maintenance-policy=TERMINATE
```

#### Option 2: T4 (N1 family) (often available)

```bash
gcloud compute instances create vocalx-worker \
  --zone=us-central1-a \
  --machine-type=n1-standard-4 \
  --accelerator=type=nvidia-tesla-t4,count=1 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=vocalx-worker \
  --boot-disk-size=200GB \
  --maintenance-policy=TERMINATE
```

SSH in:

```bash
gcloud compute ssh vocalx-worker --zone=us-central1-a
```

### 4.1 Install NVIDIA driver + Docker (recommended)

On the worker VM:

```bash
sudo apt-get update -y
sudo apt-get install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Install NVIDIA driver (Compute Engine provides an easy helper):

```bash
sudo apt-get install -y linux-headers-$(uname -r)
curl -fsSL https://raw.githubusercontent.com/GoogleCloudPlatform/compute-gpu-installation/main/linux/install_gpu_driver.py -o install_gpu_driver.py
sudo python3 install_gpu_driver.py
sudo reboot
```

After reboot:

```bash
nvidia-smi
```

---

## 5) Load SAM-Audio on the Worker VM (HF gated model)

This section explains how to run `facebook/sam-audio-large` on the GPU VM.

### 5.1 Create a Hugging Face token
On your computer:
1. Go to Hugging Face → Settings → Access Tokens.
2. Create a token with **Read** access.
3. Confirm you already clicked **“Agree and access”** on `facebook/sam-audio-large`.

### 5.2 Create a Python environment on the worker VM

On the worker VM:

```bash
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-pip ffmpeg
python3 -m venv ~/venv
source ~/venv/bin/activate
pip install -U pip setuptools wheel
```

### 5.3 Install PyTorch with CUDA

```bash
source ~/venv/bin/activate
pip install --index-url https://download.pytorch.org/whl/cu121 torch torchaudio
```

### 5.4 Install SAM-Audio + dependencies

```bash
source ~/venv/bin/activate
pip install "huggingface-hub>=0.34.0,<1.0" "transformers"
pip install git+https://github.com/facebookresearch/sam-audio.git
```

### 5.5 Authenticate to Hugging Face on the worker VM

```bash
source ~/venv/bin/activate
huggingface-cli login
```

Paste your HF token when prompted.

### 5.6 Quick test: load the model

Run:

```bash
source ~/venv/bin/activate
python - <<'PY'
import torch
from sam_audio import SAMAudio, SAMAudioProcessor

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("device:", device)
model = SAMAudio.from_pretrained("facebook/sam-audio-large").to(device).eval()
processor = SAMAudioProcessor.from_pretrained("facebook/sam-audio-large")
print("model loaded OK")
PY
```

If that prints `model loaded OK`, your GPU worker can load the gated model successfully.

---

## 6) Worker service (how the webapp talks to the model)

Run your model server in a Docker container based on `nvidia/cuda` and Python 3.10.
This isolates dependencies and avoids “Colab-style” package conflicts.

At minimum your worker must implement:

- `POST /sam_audio/separate` (multipart) **or**
- `POST /v1/jobs` and `GET /v1/jobs/{id}` (recommended for async)

And it should require:

- `Authorization: Bearer $WORKER_API_KEY` (recommended)

> For a single-user MVP, logging in once with `huggingface-cli login` is acceptable. For production, put the HF token in Secret Manager and inject it at runtime.

---

## 7) DNS + TLS (HTTPS)

For MVP you can start with IPs, but you should move to HTTPS quickly because browsers and auth flows are strict.

Recommended:
- Point a domain to the webapp VM external IP (A record)
- Point a domain to the worker VM external IP (A record)

Then use Caddy or Nginx + Let’s Encrypt on each VM.

---

## 8) Validate end-to-end

1. Confirm webapp loads: `https://YOUR_WEBAPP_DOMAIN`
2. Confirm worker health: `https://YOUR_WORKER_DOMAIN/health`
3. In webapp, set:
   - `WORKER_URL=https://YOUR_WORKER_DOMAIN`
   - `WORKER_API_KEY=...`
4. Upload a file in Studio → run isolation → download WAV.

---

## 9) Notes / recommended MVP choices

- **MongoDB**: this guide uses self-hosted MongoDB (not Atlas). For 1 user, hosting it on the same VM is the simplest.
- **Storage**:
  - MVP: keep S3 as-is if you already have it working.
  - Later: migrate to GCS (requires code changes from AWS SDK to GCS SDK or an S3-compatible layer).

---

## Appendix: Option B (MongoDB on a separate tiny VM)

If you want MongoDB on its own VM:
1. Create a second VM with a tiny machine type (example `e2-micro`).
2. Install MongoDB there (same steps).
3. Bind MongoDB to the VM’s **internal IP** (not public), and create a firewall rule that only allows the webapp VM to connect on port 27017.
4. In the webapp `.env.local`, set:
   - `MONGO_URL=mongodb://...@MONGO_INTERNAL_IP:27017/vocalx?authSource=admin`



