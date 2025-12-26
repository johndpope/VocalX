# Lightning.ai MVP: Local webapp + Lightning-hosted SAM-Audio (Docker)

This is an MVP-friendly setup:

- You keep developing the **webapp locally** (or later deploy it anywhere CPU).
- You deploy the **model worker on Lightning.ai** (GPU).
- The webapp calls the worker by setting `WORKER_URL`.

This avoids GCP quota issues while keeping your architecture the same.

> Lightning homepage: [`https://lightning.ai/`](https://lightning.ai/)

---

## 0) What you need ready

1. A Lightning.ai account.
2. A Hugging Face token with access to the gated model:
   - `facebook/sam-audio-small` (recommended for MVP)
3. Your webapp already expects a worker endpoint:
   - `POST /sam_audio/separate` (multipart)

We provide a worker container in this repo:
- `infrastructure/vertex/sam-audio-worker/` (it works on Vertex **and** Lightning)

---

## 1) Build the worker Docker image (from your PC)

You need Docker installed locally.

From the repo root:

```bash
docker build -t sam-audio-worker:latest infrastructure/vertex/sam-audio-worker
```

> This image downloads model weights at runtime using `HF_TOKEN`.

---

## 2) Push the image to a container registry Lightning can pull from

Pick one:
- Docker Hub
- GitHub Container Registry (GHCR)

Example (Docker Hub):
1. Create a Docker Hub repo like `lohitmilano/sam-audio-worker`.
2. Login and push:

```bash
docker tag sam-audio-worker:latest YOUR_DOCKERHUB_USER/sam-audio-worker:latest
docker push YOUR_DOCKERHUB_USER/sam-audio-worker:latest
```

---

## 3) Deploy on Lightning.ai (GUI)

Lightning has multiple product surfaces; the key requirement is:
- run a GPU machine
- run a long-lived service
- expose a public URL/port

Note:
- Prefer deploying the container directly via the Lightning GUI (as a service/app).
- Running `docker run` *inside* a Lightning terminal/session often won't have GPU access.
### Run the container
1. Create a new Lightning project/workspace.
2. Create a GPU instance/session (choose the smallest GPU available for MVP).
3. Add environment variables (secrets):
   - `HF_TOKEN` = your Hugging Face token
   - `SAM_MODEL_ID` = `facebook/sam-audio-small`
   - (optional) `WORKER_API_KEY` = a password you choose
4. Run the container and expose port **8080**:

```bash
docker run --rm -p 8080:8080 \
  -e HF_TOKEN="$HF_TOKEN" \
  -e SAM_MODEL_ID="facebook/sam-audio-small" \
  -e WORKER_API_KEY="$WORKER_API_KEY" \
   YOUR_DOCKERHUB_USER/sam-audio-worker:latest
```

5. Lightning will provide a public URL for the exposed port (often via a “share” / “expose” UI).

### Confirm the worker is live
Open:
- `GET /health`

You should see JSON `{ ok: true, device: "cuda" }` (or similar).

---

## 4) Point your webapp to Lightning

In `apps/webapp/.env.local`:

```bash
WORKER_URL=https://YOUR_LIGHTNING_PUBLIC_URL
WORKER_API_KEY=YOUR_OPTIONAL_KEY
```

Important:
- Do **not** set `VERTEX_PROJECT_ID / VERTEX_LOCATION / VERTEX_ENDPOINT_ID` when using Lightning.
- Restart the webapp.

Now Studio calls:
- `POST {WORKER_URL}/sam_audio/separate`

---

## 5) MVP testing flow

1. Open your local webapp Studio.
2. Upload a short audio file (keep it small for MVP).
3. Prompt: “A man speaking”
4. Click “Isolate sound”
5. Download WAV outputs.

---

## Troubleshooting

### The first request is slow
Normal: the container downloads gated HF weights on first use.

### 401/403 from worker
You set `WORKER_API_KEY` but the webapp is not sending it:
- Set `WORKER_API_KEY` in webapp `.env.local` too.

### Out of memory
Use `facebook/sam-audio-small` and keep input audio short.


