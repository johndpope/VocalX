import base64
import os
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

import torch
import torchaudio
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from sam_audio import SAMAudio, SAMAudioProcessor

app = FastAPI(title="Vertex SAM-Audio Worker")


class Instance(BaseModel):
    audio_b64: str
    filename: str = "input"
    description: str = ""
    anchors_json: str = ""
    which: str = "target"  # "target" | "residual"
    predict_spans: bool = False
    reranking_candidates: int = 0


class PredictRequest(BaseModel):
    instances: List[Instance]


_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_MODEL: Optional[SAMAudio] = None
_PROCESSOR: Optional[SAMAudioProcessor] = None


def _require_auth(authorization: Optional[str]):
    """
    Optional bearer token auth for public deployments.
    If WORKER_API_KEY is not set, auth is not required.
    """
    key = os.getenv("WORKER_API_KEY", "").strip()
    if not key:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != key:
        raise HTTPException(status_code=403, detail="Invalid token")


def _ensure_loaded():
    global _MODEL, _PROCESSOR
    if _MODEL is not None and _PROCESSOR is not None:
        return

    hf_token = os.getenv("HF_TOKEN", "").strip()
    if not hf_token:
        raise RuntimeError("HF_TOKEN is required (gated Hugging Face model access)")

    # HF auth (works with huggingface_hub + transformers)
    os.environ["HUGGINGFACE_HUB_TOKEN"] = hf_token

    model_id = os.getenv("SAM_MODEL_ID", "facebook/sam-audio-small").strip()
    _MODEL = SAMAudio.from_pretrained(model_id).to(_DEVICE).eval()
    _PROCESSOR = SAMAudioProcessor.from_pretrained(model_id)


def _to_wav_path(input_path: str, out_path: str) -> None:
    """
    Convert input media to WAV using ffmpeg.
    This supports mp3/mp4/etc so the webapp can upload anything.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        input_path,
        "-acodec",
        "pcm_s16le",
        "-ac",
        "2",
        "-ar",
        "44100",
        out_path,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError("ffmpeg failed: " + proc.stderr.decode("utf-8", errors="ignore"))


def _write_wav_bytes(wave: torch.Tensor, sample_rate: int) -> bytes:
    # torchaudio.save expects (channels, time)
    if wave.dim() == 1:
        wave = wave.unsqueeze(0)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        out_path = f.name
    try:
        torchaudio.save(out_path, wave.cpu(), sample_rate)
        with open(out_path, "rb") as rf:
            return rf.read()
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass


@app.get("/health")
def health():
    return {"ok": True, "device": str(_DEVICE)}


@app.post("/sam_audio/separate")
async def sam_audio_separate(
    authorization: Optional[str] = Header(default=None),
    audio: UploadFile = File(...),
    description: str = Form(default=""),
    anchors_json: str = Form(default=""),
    predict_spans: str = Form(default="false"),
    reranking_candidates: str = Form(default="0"),
) -> Dict[str, Any]:
    """
    Compatibility endpoint for the VocalX webapp:
    - multipart fields: audio, description, anchors_json, predict_spans, reranking_candidates
    - returns: { ok, target_wav_base64, residual_wav_base64 }
    """
    _require_auth(authorization)
    _ensure_loaded()
    assert _MODEL is not None
    assert _PROCESSOR is not None

    raw = await audio.read()
    if not raw:
        return {"ok": False, "error": "Empty file"}

    with tempfile.TemporaryDirectory() as td:
        in_path = os.path.join(td, audio.filename or "input")
        wav_path = os.path.join(td, "input.wav")
        with open(in_path, "wb") as f:
            f.write(raw)
        _to_wav_path(in_path, wav_path)

        anchors = None
        if anchors_json and anchors_json.strip():
            import json as _json

            anchors = [_json.loads(anchors_json)]

        batch = _PROCESSOR(
            audios=[wav_path],
            descriptions=[description or ""],
            anchors=anchors,
        ).to(_DEVICE)

        with torch.inference_mode():
            result = _MODEL.separate(
                batch,
                predict_spans=str(predict_spans).lower() in ("true", "1", "yes"),
                reranking_candidates=int(reranking_candidates or 0),
            )

        sr = int(getattr(_PROCESSOR, "audio_sampling_rate", 44100))
        target = result.target[0]
        residual = result.residual[0]

        target_b64 = base64.b64encode(_write_wav_bytes(target, sr)).decode("utf-8")
        residual_b64 = base64.b64encode(_write_wav_bytes(residual, sr)).decode("utf-8")

        return {"ok": True, "target_wav_base64": target_b64, "residual_wav_base64": residual_b64}


@app.post("/predict")
def predict(req: PredictRequest) -> Dict[str, Any]:
    """
    Vertex AI prediction route.
    Returns { "predictions": [ ... ] }.
    """
    _ensure_loaded()
    assert _MODEL is not None
    assert _PROCESSOR is not None

    preds: List[Dict[str, Any]] = []

    for inst in req.instances:
        if not inst.audio_b64:
            preds.append({"ok": False, "error": "Missing audio_b64"})
            continue

        raw = base64.b64decode(inst.audio_b64)
        if not raw:
            preds.append({"ok": False, "error": "Empty audio"})
            continue

        with tempfile.TemporaryDirectory() as td:
            in_path = os.path.join(td, inst.filename or "input")
            wav_path = os.path.join(td, "input.wav")
            with open(in_path, "wb") as f:
                f.write(raw)

            # Convert to wav for consistent processing
            _to_wav_path(in_path, wav_path)

            # anchors_json is a string representation like:
            # [["+", 6.3, 7.0], ["-", 0.0, 1.0]]
            anchors = None
            if inst.anchors_json and inst.anchors_json.strip():
                import json as _json

                anchors = [_json.loads(inst.anchors_json)]

            batch = _PROCESSOR(
                audios=[wav_path],
                descriptions=[inst.description or ""],
                anchors=anchors,
            ).to(_DEVICE)

            with torch.inference_mode():
                result = _MODEL.separate(
                    batch,
                    predict_spans=bool(inst.predict_spans),
                    reranking_candidates=int(inst.reranking_candidates or 0),
                )

            sr = int(getattr(_PROCESSOR, "audio_sampling_rate", 44100))
            target = result.target[0]
            residual = result.residual[0]

            target_b64 = base64.b64encode(_write_wav_bytes(target, sr)).decode("utf-8")
            residual_b64 = base64.b64encode(_write_wav_bytes(residual, sr)).decode("utf-8")

            preds.append(
                {
                    "ok": True,
                    "target_wav_base64": target_b64,
                    "residual_wav_base64": residual_b64,
                }
            )

    return {"predictions": preds}


