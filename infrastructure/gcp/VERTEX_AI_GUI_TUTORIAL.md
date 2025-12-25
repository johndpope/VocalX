# Vertex AI (GUI) Tutorial: Deploy SAM Audio *small* + run VocalX webapp on CPU

This is a **GUI-only** guide (no `gcloud` required). You will still copy/paste a few commands into built‑in browser terminals for building containers.

## What you will deploy

- **Vertex AI Endpoint (GPU)** running a custom container:
  - `infrastructure/vertex/sam-audio-worker/`
  - Loads **`facebook/sam-audio-small`** from Hugging Face (gated)
- **Webapp (CPU)** on Cloud Run (simple) or Compute Engine (advanced)

The webapp calls Vertex using IAM auth when these env vars are set:
- `VERTEX_PROJECT_ID`
- `VERTEX_LOCATION`
- `VERTEX_ENDPOINT_ID`

---

## 1) Enable required APIs (GUI)

In GCP Console:
1. Left menu → **APIs & Services** → **Library**
2. Enable:
   - **Vertex AI API**
   - **Artifact Registry API**
   - **Cloud Build API**

---

## 2) Create a Hugging Face token (gated model)

1. Go to Hugging Face → Settings → Access Tokens → create **Read** token.
2. Confirm you clicked **“Agree and access”** for `facebook/sam-audio-small`.

---

## 3) Store HF token in Secret Manager (GUI)

1. Left menu → **Security** → **Secret Manager**
2. **Create secret**
3. Name: `HF_TOKEN`
4. Value: paste your Hugging Face token
5. Create

---

## 4) Create an Artifact Registry repository (GUI)

1. Left menu → **Artifact Registry** → **Repositories**
2. **Create repository**
3. Format: **Docker**
4. Location type: **Region**
5. Region: choose (example `us-central1`)
6. Name: `vocalx-containers`
7. Create

---

## 5) Build & push the SAM worker container (GUI via Cloud Shell)

1. Open **Cloud Shell** (top right terminal icon).
2. Clone your repo:

```bash
git clone https://github.com/lohitmilano/VocalX.git
cd VocalX
```

3. Build and push using Cloud Build (replace REGION):

```bash
REGION=us-central1
PROJECT_ID=$(gcloud config get-value project)
IMAGE_URI=$REGION-docker.pkg.dev/$PROJECT_ID/vocalx-containers/sam-audio-worker:latest

gcloud builds submit --tag "$IMAGE_URI" infrastructure/vertex/sam-audio-worker
echo "IMAGE_URI=$IMAGE_URI"
```

Copy the printed `IMAGE_URI`.

---

## 6) Create a Vertex AI Model (GUI)

1. Left menu → **Vertex AI** → **Model Registry**
2. Click **Import model**
3. Model name: `sam-audio-small-worker`
4. Container settings:
   - Container image: paste `IMAGE_URI`
   - **Health route**: `/health`
   - **Predict route**: `/predict`
5. Environment variables:
   - `SAM_MODEL_ID` = `facebook/sam-audio-small`
6. Click **Advanced** → **Add secret environment variable**
   - Name: `HF_TOKEN`
   - Secret: `HF_TOKEN`
   - Version: `latest`
7. Click **Import**

---

## 7) Create an Endpoint + deploy the model (GUI)

1. Vertex AI → **Online prediction** → **Endpoints**
2. **Create endpoint**
3. Name: `vocalx-sam-audio`
4. Region: `us-central1` (or your chosen region)
5. Create

Now deploy:
1. Open the endpoint
2. Click **Deploy model**
3. Select model: `sam-audio-small-worker`
4. Machine type: start with a small CPU machine, then add GPU:
   - Choose a machine type that is supported for GPU in your region
   - Add **1 GPU** (T4 or L4 depending on quota/availability)
5. Min replicas: `1`
6. Max replicas: `1` (single-user MVP)
7. Deploy

After deploy, copy:
- **Endpoint ID** (shown in the endpoint page URL/details)
- Region

---

## 8) Deploy the webapp on CPU (GUI) — Cloud Run (recommended)

### 8.1 Create a Service Account for the webapp (GUI)
1. IAM & Admin → **Service Accounts**
2. **Create service account**
3. Name: `vocalx-webapp-sa`
4. Grant roles:
   - **Vertex AI User**
5. Create

### 8.2 Deploy Cloud Run from source (GUI)
1. Left menu → **Cloud Run**
2. **Create service**
3. Source: **Deploy from source repository**
4. Connect GitHub and pick `lohitmilano/VocalX`
5. Branch: `main`
6. Build type: **Google Cloud Build**
7. Service name: `vocalx-webapp`
8. Region: same as Vertex endpoint (recommended)
9. Authentication: **Allow unauthenticated** (for MVP) OR restrict if you prefer
10. Advanced settings:
   - **Service account**: `vocalx-webapp-sa`
11. Environment variables:
   - `VERTEX_PROJECT_ID` = your project id (example `vocalx`)
   - `VERTEX_LOCATION` = `us-central1`
   - `VERTEX_ENDPOINT_ID` = your endpoint id
   - `NEXTAUTH_SECRET` = set a random secret
   - `NEXTAUTH_URL` = Cloud Run URL (after deploy you can update)
   - `MONGO_URL` / `MONGO_DB_NAME` as needed for your DB
12. Create

Once deployed, open the Cloud Run URL and test Studio.

---

## 9) Webapp env summary (what you set)

To use Vertex, you do **not** need `WORKER_URL`. You need:
- `VERTEX_PROJECT_ID`
- `VERTEX_LOCATION`
- `VERTEX_ENDPOINT_ID`

---

## Notes (quota)

If you don’t have GPU quota, the Endpoint deployment will fail. In that case:
- Try a different region
- Request quota increase (IAM/Quota page)
- Or temporarily use Compute Engine spot GPU


