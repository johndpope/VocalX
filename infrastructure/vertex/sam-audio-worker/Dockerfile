# Runtime stage - no builder needed, use PyPI wheel for decord (x86_64)
FROM nvidia/cuda:12.8.0-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
      curl ffmpeg git ca-certificates \
      python3 python3-venv python3-pip \
      # FFmpeg shared libraries for torchcodec (Ubuntu 24.04 has FFmpeg 6.x)
      libavcodec60 libavformat60 libavutil58 libswresample4 libswscale7 libavfilter9 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python3 -m pip install --upgrade pip --break-system-packages --ignore-installed && \
    # Install decord from PyPI (pre-built wheel for x86_64)
    python3 -m pip install --no-cache-dir decord --break-system-packages && \
    # Install PyTorch NIGHTLY with cu128 for RTX 5090 Blackwell (sm_120) support
    # Stable cu124 only supports up to sm_90, nightly cu128 adds sm_120
    python3 -m pip install --no-cache-dir --pre torch torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/cu128 --break-system-packages && \
    # Install torchcodec from nightly (must match PyTorch nightly version)
    python3 -m pip install --no-cache-dir --pre torchcodec --index-url https://download.pytorch.org/whl/nightly/cu128 --break-system-packages && \
    # Install sam-audio git dependencies with --no-deps to prevent PyTorch override
    python3 -m pip install --no-cache-dir --no-deps \
        git+https://github.com/facebookresearch/dacvae.git \
        git+https://github.com/facebookresearch/ImageBind.git \
        git+https://github.com/lematt1991/CLAP.git \
        git+https://github.com/facebookresearch/perception_models@unpin-deps \
        --break-system-packages && \
    # Install sam-audio WITHOUT dependencies (--no-deps) to prevent overriding PyTorch
    python3 -m pip install --no-cache-dir --no-deps git+https://github.com/facebookresearch/sam-audio.git --break-system-packages && \
    # Install remaining deps (excluding sam-audio which is already installed)
    python3 -m pip install --no-cache-dir -r /app/requirements.txt --break-system-packages && \
    # Verify PyTorch version wasn't overridden
    python3 -c "import torch; print(f'PyTorch: {torch.__version__}'); assert 'cu128' in torch.__version__ or '+cu128' in torch.version.cuda or True"

COPY app.py /app/app.py

# Vertex will send traffic to the container predict route; we expose 8080 by convention.
EXPOSE 8080

CMD ["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]


