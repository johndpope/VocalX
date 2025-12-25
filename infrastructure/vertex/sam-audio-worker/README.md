# Vertex AI SAM-Audio Worker (Custom Container)

This is a **Vertex AI Endpoint** compatible prediction container for **SAM Audio**.

It implements:
- `GET /health`
- `POST /predict` (Vertex prediction route)

The webapp calls Vertex `rawPredict`, and Vertex forwards the request body to `/predict`.

## Environment variables (runtime)

- `HF_TOKEN` (required): Hugging Face token with access to the gated model
- `SAM_MODEL_ID` (optional): default `facebook/sam-audio-small`

## Request format (what the webapp sends)

Vertex forwards JSON like:

```json
{
  "instances": [
    {
      "audio_b64": "...",
      "filename": "input.wav",
      "description": "A man speaking",
      "anchors_json": "",
      "which": "target",
      "predict_spans": false,
      "reranking_candidates": 0
    }
  ]
}
```

## Response format (what we return)

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


