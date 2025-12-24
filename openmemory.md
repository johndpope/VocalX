# VocalX – OpenMemory Guide

## Overview
- Repo is transitioning from a heavy on-device Android ML app to a **cloud-first** architecture.
- Current monorepo layout:
  - `apps/webapp`: Next.js 14 web app + API (NextAuth + MongoDB/Mongoose + S3 signed uploads + processing job endpoints)
  - `apps/mobile`: Expo / React Native “light client” that hosts the webapp inside a WebView (so auth/upload works immediately)

## Architecture (current)
- **Webapp (`apps/webapp`)**
  - Auth: NextAuth route + middleware gate for protected pages
  - DB: MongoDB (Mongoose models + native driver for migration scripts)
  - Storage: S3 signed upload endpoint implemented (download/delete TODO)
  - Processing: submit/status/cancel endpoints; Paperspace and Stripe are currently **stubbed** until keys are provided

- **Mobile (`apps/mobile`)**
  - Tabs: Studio / History / Settings
  - Studio + History: WebView screens pointing to `/studio` and `/history`
  - Settings: stores webapp base URL in AsyncStorage; on first launch the app auto-detects the best URL by probing `/api/v1/health` and persists it (default emulator: `http://10.0.2.2:3000`)

## Components / Key Files
- `apps/webapp/models/*`: Mongoose schemas for core data
- `apps/webapp/lib/mongo.ts`: shared Mongoose connection helper
- `apps/webapp/app/api/v1/files/upload/route.ts`: S3 signed upload + DB record
- `apps/webapp/app/api/v1/processing/submit/route.ts`: create job + stub Paperspace submission
- `apps/mobile/src/components/WebappScreen.tsx`: reusable WebView container for webapp pages
- `apps/mobile/src/config/webapp.ts`: base URL storage
- `infrastructure/paperspace/worker/app.py`: local/worker service using 🤗 Transformers (loads SAM3 + PE‑AV from local folders)
- `apps/webapp/app/local/page.tsx`: **no-auth local test UI** (uploads a file + prompt and downloads separated WAV)
- `apps/webapp/app/api/local/separate/route.ts`: **local dev API** that forwards multipart form-data to the worker’s `/sam_audio/separate`
- `apps/webapp/app/(studio)/studio/StudioClient.tsx`: **Studio UI** (Audio/Video/Multimodal tabs, 3-column layout, prompt history, Audio-mode run wired to `/api/local/separate`)
- `apps/webapp/middleware.ts`: in local dev, disables auth gating for studio routes when no OAuth providers are configured

## Local dev notes (December 2025)
- Model folders are now under `apps/webapp/Models/` with these names:
  - `SAM3/`
  - `SAM PE AV/`
  - `SAM Audio/` (SAM-Audio separation weights; must contain checkpoint files)
- Worker endpoints:
  - `GET :8000/health`
  - `POST :8000/load` (returns structured `errors` if model code is missing)
  - `POST :8000/sam_audio/separate` (requires `sam_audio` python package + SAM-Audio weights; returns base64 WAVs)
- Worker runtime:
  - Windows Python 3.13 cannot install Meta SAM-Audio cleanly; use **WSL (Python 3.12)** venv at `infrastructure/paperspace/worker/.venv-wsl`
  - SAM-Audio load is memory-heavy; worker now fails fast with an “Insufficient RAM” error (instead of OOM-crashing) when available RAM is below `VOCALX_MIN_SAM_AUDIO_AVAIL_GB` (default 10GB)
- Webapp local test page:
  - Set `LOCAL_WORKER_URL=http://localhost:8000`
  - Start webapp (dev server may pick 3001 if 3000 is busy)
  - Open `/local` and run a separation test

## UI / Product shape (draft)
- Webapp is evolving toward a **prompt-centric** editor:
  - **Audio Studio**: waveform lanes (original/target/residual), text + span prompts, prompt history as nodes
  - **Video Studio**: SAM3 prompt + propagate with mask overlays (next)
  - **Multimodal Studio**: combine text + time + visual selections into a single prompt node (next)

## User Defined Namespaces
- 

## Legacy / Archived
- The old native Android/Gradle project and on-device SAM-Audio docs/models are archived in `legacy/android-native/`.
