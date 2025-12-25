FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
      software-properties-common curl \
      ffmpeg git ca-certificates && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update -y && \
    apt-get install -y --no-install-recommends \
      python3.11 python3.11-venv python3.11-distutils && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py && \
    python3.11 /tmp/get-pip.py && \
    rm -f /tmp/get-pip.py && \
    python3.11 -m pip install --upgrade pip setuptools wheel && \
    # Install CUDA-enabled torch/torchaudio to match the CUDA runtime base image.
    python3.11 -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu121 torch torchaudio && \
    python3.11 -m pip install --no-cache-dir -r /app/requirements.txt

COPY app.py /app/app.py

# Vertex will send traffic to the container predict route; we expose 8080 by convention.
EXPOSE 8080

CMD ["python3.11", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]


