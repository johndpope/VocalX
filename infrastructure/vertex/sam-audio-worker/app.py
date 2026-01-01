import base64
import json as _json
import os
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

import torch
import torchaudio
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from sam_audio import SAMAudio, SAMAudioProcessor
from sam_audio.model.config import ClapRankerConfig
from sam_audio.ranking.clap import ClapRanker

app = FastAPI(title="Vertex SAM-Audio Worker")


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────────────────────────


class Instance(BaseModel):
    audio_b64: str
    filename: str = "input"
    description: str = ""
    anchors_json: str = ""
    which: str = "target"  # "target" | "residual"
    predict_spans: bool = False
    reranking_candidates: int = 0


class DisentangleInstance(BaseModel):
    """Request model for instrument disentangling."""
    audio_b64: str
    filename: str = "input"
    # If empty, auto-detect instruments using CLAP introspection
    descriptions: List[str] = []
    # Detection threshold for CLAP scores (0.0-1.0), default 0.2
    threshold: float = 0.2
    # Fallback to top N if none above threshold
    top_k_fallback: int = 5
    # Separation parameters
    predict_spans: bool = True
    reranking_candidates: int = 8


class PredictRequest(BaseModel):
    instances: List[Instance]


class DisentangleRequest(BaseModel):
    instances: List[DisentangleInstance]


# ─────────────────────────────────────────────────────────────────────────────
# Global State
# ─────────────────────────────────────────────────────────────────────────────

_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_MODEL: Optional[SAMAudio] = None
_PROCESSOR: Optional[SAMAudioProcessor] = None
_CLAP_RANKER: Optional[ClapRanker] = None


# ─────────────────────────────────────────────────────────────────────────────
# Sound Atlas: Comprehensive instrument descriptions from AudioSet ontology
# Organized by category for clarity, flattened for CLAP scoring
# Uses lowercase NP/VP format as recommended for SAM-Audio prompts
# ─────────────────────────────────────────────────────────────────────────────

SOUND_ATLAS = [
    # ── Plucked Strings ──────────────────────────────────────────────────────
    "plucked string instrument",
    "guitar playing",
    "acoustic guitar strumming",
    "electric guitar riff",
    "electric guitar distorted",
    "clean electric guitar",
    "bass guitar",
    "slap bass",
    "fingerpicking guitar",
    "ukulele",
    "banjo",
    "mandolin",
    "sitar",
    "lute",
    "zither",
    "harp plucking",
    "steel guitar",
    "slide guitar",
    "twelve string guitar",

    # ── Keyboard Instruments ─────────────────────────────────────────────────
    "keyboard musical instrument",
    "piano playing",
    "grand piano",
    "upright piano",
    "electric piano",
    "rhodes piano",
    "organ",
    "church organ",
    "hammond organ",
    "synthesizer",
    "synthesizer pad",
    "synthesizer lead",
    "harpsichord",
    "clavichord",
    "celesta",
    "melodica",

    # ── Percussion ───────────────────────────────────────────────────────────
    "percussion instrument",
    "drum kit",
    "drum beating",
    "snare drum",
    "snare drum rimshot",
    "bass drum",
    "kick drum",
    "hi-hat cymbal",
    "crash cymbal",
    "ride cymbal",
    "cymbals crashing",
    "tom drum",
    "floor tom",
    "gong",
    "marimba",
    "xylophone",
    "vibraphone",
    "timpani",
    "cowbell",
    "rattle instrument",
    "wood block",
    "tambourine",
    "bongo drums",
    "conga drum",
    "djembe",
    "cajon",
    "shaker",
    "claves",
    "triangle instrument",
    "chimes",
    "tubular bells",
    "steel drum",
    "tabla",
    "electronic drum machine",
    "drum loop",
    "percussion loop",

    # ── Brass ────────────────────────────────────────────────────────────────
    "brass instrument",
    "trumpet",
    "trumpet with mute",
    "trombone",
    "french horn",
    "tuba",
    "cornet",
    "flugelhorn",
    "euphonium",
    "brass section",

    # ── Bowed Strings ────────────────────────────────────────────────────────
    "bowed string instrument",
    "violin playing",
    "violin pizzicato",
    "viola",
    "cello",
    "double bass bowed",
    "string section",
    "string orchestra",
    "fiddle",
    "erhu",

    # ── Woodwinds ────────────────────────────────────────────────────────────
    "wind instrument",
    "woodwind instrument",
    "flute",
    "piccolo",
    "recorder instrument",
    "clarinet",
    "bass clarinet",
    "oboe",
    "english horn",
    "bassoon",
    "contrabassoon",
    "saxophone",
    "alto saxophone",
    "tenor saxophone",
    "soprano saxophone",
    "baritone saxophone",
    "pan flute",

    # ── Free Reed / Bellows ──────────────────────────────────────────────────
    "harmonica",
    "blues harmonica",
    "accordion",
    "concertina",
    "bandoneon",
    "harmonium",

    # ── World / Ethnic ───────────────────────────────────────────────────────
    "bagpipes",
    "didgeridoo",
    "shofar",
    "kalimba",
    "mbira",
    "shamisen",
    "koto",
    "pipa",
    "oud",
    "bouzouki",
    "balalaika",
    "gamelan",
    "steel pan",
    "hang drum",

    # ── Electronic / Modern ──────────────────────────────────────────────────
    "theremin",
    "electronic music",
    "electronic beat",
    "synth bass",
    "808 bass",
    "909 drum",
    "arpeggiator",
    "vocoder",
    "turntable scratching",
    "scratching performance technique",
    "sampler",
    "drum and bass beat",
    "dubstep wobble",

    # ── Vocals ───────────────────────────────────────────────────────────────
    "singing",
    "male singing",
    "female singing",
    "choir singing",
    "vocal harmony",
    "background vocals",
    "lead vocals",
    "rapping",
    "beatboxing",
    "humming",
    "whistling",
    "yodeling",
    "opera singing",
    "falsetto",
    "vocal runs",
    "autotune vocals",

    # ── Bells / Resonant ─────────────────────────────────────────────────────
    "bell ringing",
    "church bell",
    "jingle bell",
    "singing bowl",
    "glockenspiel",
    "handbell",
    "cowbell",
    "wind chimes",

    # ── Ensembles / Groups ───────────────────────────────────────────────────
    "orchestra playing",
    "musical ensemble",
    "jazz band",
    "rock band",
    "marching band",
    "big band",
    "chamber music",
    "string quartet",

    # ── Sound Roles / Textures ───────────────────────────────────────────────
    "bass instrument role",
    "rhythm section",
    "melody line",
    "lead instrument",
    "accompaniment",
    "drone sound",
    "ambient pad",
    "sound effects",
    "noise texture",
]


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
    global _MODEL, _PROCESSOR, _CLAP_RANKER
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

    # Load CLAP ranker for instrument introspection
    _CLAP_RANKER = ClapRanker(ClapRankerConfig())


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


def _introspect_audio(
    audio_tensor: torch.Tensor,
    sample_rate: int,
    descriptions: List[str],
    threshold: float = 0.2,
    top_k_fallback: int = 5,
) -> tuple[List[str], Dict[str, float]]:
    """
    Use CLAP ranker to score audio against a list of descriptions.
    Returns selected descriptions (above threshold or top-k fallback) and all scores.
    """
    assert _CLAP_RANKER is not None, "CLAP ranker not loaded"

    # Ensure audio is 1D for CLAP scoring
    if audio_tensor.dim() > 1:
        audio_1d = audio_tensor.mean(0) if audio_tensor.size(0) > 1 else audio_tensor.squeeze(0)
    else:
        audio_1d = audio_tensor

    # Repeat audio for batch scoring against all descriptions
    num_desc = len(descriptions)
    extracted_audio = [audio_1d.cpu()] * num_desc

    with torch.inference_mode():
        scores = _CLAP_RANKER(
            extracted_audio=extracted_audio,
            descriptions=descriptions,
            sample_rate=sample_rate,
        ).squeeze(-1).cpu()

    # Build score dict
    score_dict = {desc: float(scores[i]) for i, desc in enumerate(descriptions)}

    # Select descriptions above threshold
    selected = [descriptions[i] for i in range(num_desc) if scores[i] > threshold]

    # Fallback to top-k if none above threshold
    if not selected and top_k_fallback > 0:
        top_indices = scores.topk(min(top_k_fallback, num_desc)).indices.tolist()
        selected = [descriptions[i] for i in top_indices]

    return selected, score_dict


def _disentangle_audio(
    wav_path: str,
    descriptions: List[str],
    predict_spans: bool = True,
    reranking_candidates: int = 8,
) -> tuple[List[Dict[str, Any]], torch.Tensor, int]:
    """
    Iteratively separate each described sound from the audio.
    Returns list of separated tracks, final residual, and sample rate.

    Each track dict contains:
    - description: str
    - audio: torch.Tensor
    - iteration: int (0-indexed)
    """
    assert _MODEL is not None
    assert _PROCESSOR is not None

    sr = int(getattr(_PROCESSOR, "audio_sampling_rate", 44100))

    # Load audio for iteration
    waveform, file_sr = torchaudio.load(wav_path)
    if file_sr != sr:
        waveform = torchaudio.functional.resample(waveform, file_sr, sr)

    # Convert to mono for processing
    current_audio = waveform.mean(0, keepdim=True).to(_DEVICE)

    separated_tracks: List[Dict[str, Any]] = []

    for i, desc in enumerate(descriptions):
        # Create a temp file for current residual to feed to processor
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            temp_path = tf.name

        try:
            # Save current audio state to temp file
            torchaudio.save(temp_path, current_audio.cpu(), sr)

            batch = _PROCESSOR(
                audios=[temp_path],
                descriptions=[desc],
            ).to(_DEVICE)

            with torch.inference_mode():
                result = _MODEL.separate(
                    batch,
                    predict_spans=predict_spans,
                    reranking_candidates=reranking_candidates,
                )

            # Extract separated target
            target = result.target[0]
            residual = result.residual[0]

            separated_tracks.append({
                "description": desc,
                "audio": target.cpu(),
                "iteration": i,
            })

            # Update current audio to residual for next iteration
            current_audio = residual.unsqueeze(0) if residual.dim() == 1 else residual
            current_audio = current_audio.to(_DEVICE)

        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

    # Final residual (whatever's left after all separations)
    final_residual = current_audio.squeeze(0).cpu()

    return separated_tracks, final_residual, sr


# ─────────────────────────────────────────────────────────────────────────────
# HTTP Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {
        "ok": True,
        "device": str(_DEVICE),
        "model_loaded": _MODEL is not None,
        "clap_loaded": _CLAP_RANKER is not None,
        "sound_atlas_size": len(SOUND_ATLAS),
    }


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


# ─────────────────────────────────────────────────────────────────────────────
# Instrument Disentangling Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@app.post("/sam_audio/disentangle")
async def sam_audio_disentangle(
    authorization: Optional[str] = Header(default=None),
    audio: UploadFile = File(...),
    descriptions: str = Form(default=""),  # JSON array or empty for auto-detect
    threshold: str = Form(default="0.2"),
    top_k_fallback: str = Form(default="5"),
    predict_spans: str = Form(default="true"),
    reranking_candidates: str = Form(default="8"),
) -> Dict[str, Any]:
    """
    Instrument disentangling endpoint for VocalX webapp.

    Auto-detects instruments in audio using CLAP introspection against the
    Sound Atlas (AudioSet ontology), then iteratively separates each detected
    instrument.

    Parameters:
    - audio: Audio file (MP3/MP4/WAV/etc)
    - descriptions: JSON array of descriptions to separate (optional).
                    If empty, auto-detects using CLAP scoring.
    - threshold: CLAP score threshold for auto-detection (0.0-1.0)
    - top_k_fallback: Fallback to top N instruments if none above threshold
    - predict_spans: Enable span prediction
    - reranking_candidates: Number of reranking candidates

    Returns:
    {
        "ok": true/false,
        "detected_instruments": [...],  # Descriptions selected for separation
        "introspection_scores": {...},  # All CLAP scores (if auto-detected)
        "tracks": [
            {
                "description": "...",
                "wav_base64": "...",
                "iteration": 0
            },
            ...
        ],
        "residual_wav_base64": "...",  # Final residual after all separations
        "error": "..."  # Only if ok=false
    }
    """
    _require_auth(authorization)
    _ensure_loaded()
    assert _MODEL is not None
    assert _PROCESSOR is not None
    assert _CLAP_RANKER is not None

    raw = await audio.read()
    if not raw:
        return {"ok": False, "error": "Empty file"}

    try:
        with tempfile.TemporaryDirectory() as td:
            in_path = os.path.join(td, audio.filename or "input")
            wav_path = os.path.join(td, "input.wav")
            with open(in_path, "wb") as f:
                f.write(raw)
            _to_wav_path(in_path, wav_path)

            sr = int(getattr(_PROCESSOR, "audio_sampling_rate", 44100))

            # Parse descriptions if provided
            desc_list: List[str] = []
            if descriptions and descriptions.strip():
                desc_list = _json.loads(descriptions)

            introspection_scores: Dict[str, float] = {}

            # Auto-detect instruments if no descriptions provided
            if not desc_list:
                # Load audio for introspection
                waveform, file_sr = torchaudio.load(wav_path)
                if file_sr != sr:
                    waveform = torchaudio.functional.resample(waveform, file_sr, sr)
                audio_tensor = waveform.mean(0)  # Mono for CLAP

                desc_list, introspection_scores = _introspect_audio(
                    audio_tensor=audio_tensor,
                    sample_rate=sr,
                    descriptions=SOUND_ATLAS,
                    threshold=float(threshold),
                    top_k_fallback=int(top_k_fallback),
                )

            if not desc_list:
                return {
                    "ok": False,
                    "error": "No instruments detected and no descriptions provided",
                    "introspection_scores": introspection_scores,
                }

            # Perform iterative separation
            separated_tracks, final_residual, sr = _disentangle_audio(
                wav_path=wav_path,
                descriptions=desc_list,
                predict_spans=str(predict_spans).lower() in ("true", "1", "yes"),
                reranking_candidates=int(reranking_candidates),
            )

            # Encode tracks to base64
            tracks_output = []
            for track in separated_tracks:
                wav_b64 = base64.b64encode(
                    _write_wav_bytes(track["audio"], sr)
                ).decode("utf-8")
                tracks_output.append({
                    "description": track["description"],
                    "wav_base64": wav_b64,
                    "iteration": track["iteration"],
                })

            residual_b64 = base64.b64encode(
                _write_wav_bytes(final_residual, sr)
            ).decode("utf-8")

            return {
                "ok": True,
                "detected_instruments": desc_list,
                "introspection_scores": introspection_scores,
                "tracks": tracks_output,
                "residual_wav_base64": residual_b64,
            }

    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/predict/disentangle")
def predict_disentangle(req: DisentangleRequest) -> Dict[str, Any]:
    """
    Vertex AI prediction route for instrument disentangling.

    Accepts batch of audio files for automatic instrument detection and
    iterative separation.

    Returns:
    {
        "predictions": [
            {
                "ok": true/false,
                "detected_instruments": [...],
                "introspection_scores": {...},
                "tracks": [...],
                "residual_wav_base64": "...",
                "error": "..."
            },
            ...
        ]
    }
    """
    _ensure_loaded()
    assert _MODEL is not None
    assert _PROCESSOR is not None
    assert _CLAP_RANKER is not None

    preds: List[Dict[str, Any]] = []

    for inst in req.instances:
        if not inst.audio_b64:
            preds.append({"ok": False, "error": "Missing audio_b64"})
            continue

        try:
            raw = base64.b64decode(inst.audio_b64)
            if not raw:
                preds.append({"ok": False, "error": "Empty audio"})
                continue

            with tempfile.TemporaryDirectory() as td:
                in_path = os.path.join(td, inst.filename or "input")
                wav_path = os.path.join(td, "input.wav")
                with open(in_path, "wb") as f:
                    f.write(raw)
                _to_wav_path(in_path, wav_path)

                sr = int(getattr(_PROCESSOR, "audio_sampling_rate", 44100))

                # Use provided descriptions or auto-detect
                desc_list = inst.descriptions if inst.descriptions else []
                introspection_scores: Dict[str, float] = {}

                if not desc_list:
                    # Load audio for introspection
                    waveform, file_sr = torchaudio.load(wav_path)
                    if file_sr != sr:
                        waveform = torchaudio.functional.resample(waveform, file_sr, sr)
                    audio_tensor = waveform.mean(0)

                    desc_list, introspection_scores = _introspect_audio(
                        audio_tensor=audio_tensor,
                        sample_rate=sr,
                        descriptions=SOUND_ATLAS,
                        threshold=inst.threshold,
                        top_k_fallback=inst.top_k_fallback,
                    )

                if not desc_list:
                    preds.append({
                        "ok": False,
                        "error": "No instruments detected",
                        "introspection_scores": introspection_scores,
                    })
                    continue

                # Perform iterative separation
                separated_tracks, final_residual, sr = _disentangle_audio(
                    wav_path=wav_path,
                    descriptions=desc_list,
                    predict_spans=inst.predict_spans,
                    reranking_candidates=inst.reranking_candidates,
                )

                # Encode tracks
                tracks_output = []
                for track in separated_tracks:
                    wav_b64 = base64.b64encode(
                        _write_wav_bytes(track["audio"], sr)
                    ).decode("utf-8")
                    tracks_output.append({
                        "description": track["description"],
                        "wav_base64": wav_b64,
                        "iteration": track["iteration"],
                    })

                residual_b64 = base64.b64encode(
                    _write_wav_bytes(final_residual, sr)
                ).decode("utf-8")

                preds.append({
                    "ok": True,
                    "detected_instruments": desc_list,
                    "introspection_scores": introspection_scores,
                    "tracks": tracks_output,
                    "residual_wav_base64": residual_b64,
                })

        except Exception as e:
            preds.append({"ok": False, "error": str(e)})

    return {"predictions": preds}


@app.post("/sam_audio/introspect")
async def sam_audio_introspect(
    authorization: Optional[str] = Header(default=None),
    audio: UploadFile = File(...),
    threshold: str = Form(default="0.0"),  # Return all scores by default
    top_k: str = Form(default="20"),
) -> Dict[str, Any]:
    """
    Introspection-only endpoint: Detect instruments in audio without separation.

    Returns CLAP scores for all instruments in the Sound Atlas, useful for
    understanding what's in the audio before running full disentangling.

    Parameters:
    - audio: Audio file (MP3/MP4/WAV/etc)
    - threshold: Minimum score to include in results (default 0.0 = all)
    - top_k: Return only top K scoring instruments

    Returns:
    {
        "ok": true/false,
        "detected_instruments": [...],  # Above threshold or top-k
        "scores": {...},  # All instrument -> score mappings
        "error": "..."
    }
    """
    _require_auth(authorization)
    _ensure_loaded()
    assert _CLAP_RANKER is not None
    assert _PROCESSOR is not None

    raw = await audio.read()
    if not raw:
        return {"ok": False, "error": "Empty file"}

    try:
        with tempfile.TemporaryDirectory() as td:
            in_path = os.path.join(td, audio.filename or "input")
            wav_path = os.path.join(td, "input.wav")
            with open(in_path, "wb") as f:
                f.write(raw)
            _to_wav_path(in_path, wav_path)

            sr = int(getattr(_PROCESSOR, "audio_sampling_rate", 44100))

            # Load audio
            waveform, file_sr = torchaudio.load(wav_path)
            if file_sr != sr:
                waveform = torchaudio.functional.resample(waveform, file_sr, sr)
            audio_tensor = waveform.mean(0)

            # Run introspection
            selected, all_scores = _introspect_audio(
                audio_tensor=audio_tensor,
                sample_rate=sr,
                descriptions=SOUND_ATLAS,
                threshold=float(threshold),
                top_k_fallback=int(top_k),
            )

            # Sort scores descending for readability
            sorted_scores = dict(
                sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
            )

            return {
                "ok": True,
                "detected_instruments": selected,
                "scores": sorted_scores,
            }

    except Exception as e:
        return {"ok": False, "error": str(e)}
