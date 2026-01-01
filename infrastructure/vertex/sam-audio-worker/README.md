# Vertex AI SAM-Audio Worker

A **Vertex AI Endpoint** compatible prediction container for **SAM-Audio** with automatic instrument detection and disentangling.

## Features

- **Text-guided audio separation**: Separate sounds by natural language description
- **Automatic instrument detection**: CLAP-based introspection against 180+ instrument types
- **Iterative disentangling**: Extract multiple instruments from a single audio file
- **Multi-format support**: MP3, MP4, WAV, FLAC, and any ffmpeg-supported format

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/sam_audio/separate` | POST | Single description separation (webapp) |
| `/sam_audio/disentangle` | POST | Auto-detect & separate all instruments (webapp) |
| `/sam_audio/introspect` | POST | Detect instruments without separation (webapp) |
| `/predict` | POST | Single separation (Vertex AI) |
| `/predict/disentangle` | POST | Auto-detect & separate (Vertex AI) |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HF_TOKEN` | Yes | - | Hugging Face token (gated model access) |
| `SAM_MODEL_ID` | No | `facebook/sam-audio-small` | Model variant (`small`/`base`/`large`) |
| `WORKER_API_KEY` | No | - | Optional Bearer token for auth |

## Quick Start

```bash
# Build
docker build -t sam-audio-worker .

# Run locally
docker run -p 8080:8080 \
  -e HF_TOKEN="hf_your_token" \
  sam-audio-worker

# Test health
curl http://localhost:8080/health
```

---

## API Reference

### GET /health

Returns service status and configuration.

```json
{
  "ok": true,
  "device": "cuda",
  "model_loaded": true,
  "clap_loaded": true,
  "sound_atlas_size": 180
}
```

---

### POST /sam_audio/separate

Separate audio by a single text description.

**Request** (multipart/form-data):
| Field | Type | Description |
|-------|------|-------------|
| `audio` | file | Audio file (MP3/MP4/WAV/etc) |
| `description` | string | What to extract (e.g., "drums", "vocals") |
| `anchors_json` | string | Optional time anchors: `[["+", 2.0, 4.0]]` |
| `predict_spans` | string | Enable span prediction: `"true"/"false"` |
| `reranking_candidates` | string | Reranking depth: `"0"` to `"16"` |

**Response**:
```json
{
  "ok": true,
  "target_wav_base64": "UklGR...",
  "residual_wav_base64": "UklGR..."
}
```

**Example**:
```bash
curl -X POST http://localhost:8080/sam_audio/separate \
  -F "audio=@song.mp3" \
  -F "description=drum kit"
```

---

### POST /sam_audio/disentangle

Automatically detect and separate all instruments in the audio.

**Request** (multipart/form-data):
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `audio` | file | - | Audio file |
| `descriptions` | string | `""` | JSON array of descriptions, or empty for auto-detect |
| `threshold` | string | `"0.2"` | CLAP score threshold (0.0-1.0) |
| `top_k_fallback` | string | `"5"` | Fallback to top N if none above threshold |
| `predict_spans` | string | `"true"` | Enable span prediction |
| `reranking_candidates` | string | `"8"` | Reranking depth |

**Response**:
```json
{
  "ok": true,
  "detected_instruments": ["drum kit", "electric guitar riff", "bass guitar", "male singing"],
  "introspection_scores": {
    "drum kit": 0.42,
    "electric guitar riff": 0.38,
    "bass guitar": 0.31,
    "male singing": 0.28,
    "piano playing": 0.12
  },
  "tracks": [
    {
      "description": "drum kit",
      "wav_base64": "UklGR...",
      "iteration": 0
    },
    {
      "description": "electric guitar riff",
      "wav_base64": "UklGR...",
      "iteration": 1
    }
  ],
  "residual_wav_base64": "UklGR..."
}
```

**Example** (auto-detect):
```bash
curl -X POST http://localhost:8080/sam_audio/disentangle \
  -F "audio=@song.mp4" \
  -F "threshold=0.25"
```

**Example** (explicit instruments):
```bash
curl -X POST http://localhost:8080/sam_audio/disentangle \
  -F "audio=@song.mp3" \
  -F 'descriptions=["vocals", "drums", "bass guitar"]'
```

---

### POST /sam_audio/introspect

Detect instruments without performing separation (fast analysis).

**Request** (multipart/form-data):
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `audio` | file | - | Audio file |
| `threshold` | string | `"0.0"` | Minimum score to include |
| `top_k` | string | `"20"` | Return top K instruments |

**Response**:
```json
{
  "ok": true,
  "detected_instruments": ["drum kit", "electric guitar riff", "bass guitar"],
  "scores": {
    "drum kit": 0.42,
    "electric guitar riff": 0.38,
    "bass guitar": 0.31,
    "male singing": 0.28,
    "piano playing": 0.12,
    "synthesizer": 0.08
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:8080/sam_audio/introspect \
  -F "audio=@mystery_track.mp3" \
  -F "top_k=10"
```

---

### POST /predict

Vertex AI prediction route for single separation.

**Request** (JSON):
```json
{
  "instances": [
    {
      "audio_b64": "base64_encoded_audio...",
      "filename": "input.mp3",
      "description": "vocals",
      "anchors_json": "",
      "predict_spans": false,
      "reranking_candidates": 0
    }
  ]
}
```

**Response**:
```json
{
  "predictions": [
    {
      "ok": true,
      "target_wav_base64": "...",
      "residual_wav_base64": "..."
    }
  ]
}
```

---

### POST /predict/disentangle

Vertex AI prediction route for instrument disentangling.

**Request** (JSON):
```json
{
  "instances": [
    {
      "audio_b64": "base64_encoded_audio...",
      "filename": "input.mp4",
      "descriptions": [],
      "threshold": 0.2,
      "top_k_fallback": 5,
      "predict_spans": true,
      "reranking_candidates": 8
    }
  ]
}
```

**Response**:
```json
{
  "predictions": [
    {
      "ok": true,
      "detected_instruments": ["drum kit", "guitar playing"],
      "introspection_scores": {"drum kit": 0.45, "guitar playing": 0.38},
      "tracks": [
        {"description": "drum kit", "wav_base64": "...", "iteration": 0},
        {"description": "guitar playing", "wav_base64": "...", "iteration": 1}
      ],
      "residual_wav_base64": "..."
    }
  ]
}
```

---

## Sound Atlas

The worker includes 180+ instrument descriptions from the AudioSet ontology, organized by category:

| Category | Examples |
|----------|----------|
| Plucked Strings | guitar, bass, ukulele, banjo, mandolin, sitar, harp |
| Keyboards | piano, organ, synthesizer, harpsichord, electric piano |
| Percussion | drum kit, snare, cymbals, timpani, marimba, bongos |
| Brass | trumpet, trombone, french horn, tuba |
| Bowed Strings | violin, viola, cello, double bass |
| Woodwinds | flute, clarinet, oboe, saxophone, bassoon |
| Vocals | singing, rapping, choir, beatboxing, humming |
| Electronic | synthesizer, 808 bass, drum machine, turntable |
| World/Ethnic | bagpipes, sitar, tabla, gamelan, didgeridoo |

## How It Works

### CLAP Introspection

1. Audio is encoded using CLAP (Contrastive Language-Audio Pretraining)
2. Each instrument description is also encoded to the same embedding space
3. Cosine similarity scores rank which instruments are likely present
4. Descriptions above the threshold (default 0.2) are selected for separation

### Iterative Separation

1. The highest-confidence instrument is separated first
2. The "residual" (everything except that instrument) becomes input for the next round
3. Process repeats for each detected instrument
4. Final residual contains anything not explicitly separated

```
Original Audio
    ↓
[Separate "drums"] → drums.wav
    ↓ residual
[Separate "guitar"] → guitar.wav
    ↓ residual
[Separate "vocals"] → vocals.wav
    ↓ residual
other.wav (final residual)
```

## Deployment

### Vertex AI

See the main VocalX documentation for Vertex AI deployment with custom containers.

### Lightning.ai (MVP)

```bash
# lightning_app.py
lightning run app lightning_app.py --cloud
```

### Local Docker

```bash
docker build -t sam-audio-worker .
docker run --gpus all -p 8080:8080 \
  -e HF_TOKEN="hf_xxx" \
  -e SAM_MODEL_ID="facebook/sam-audio-large" \
  sam-audio-worker
```

## Model Variants

| Model | VRAM | Quality | Speed |
|-------|------|---------|-------|
| `facebook/sam-audio-small` | ~4GB | Good | Fast |
| `facebook/sam-audio-base` | ~8GB | Better | Medium |
| `facebook/sam-audio-large` | ~16GB | Best | Slower |

## Tuning Tips

- **threshold**: Lower (0.15) catches more instruments but may include false positives. Higher (0.3) is more precise but may miss quiet instruments.
- **top_k_fallback**: If nothing scores above threshold, fall back to top N. Set to 0 to disable.
- **reranking_candidates**: Higher values (8-16) improve quality but increase latency.
- **predict_spans**: Enable for better temporal localization of intermittent sounds.
