FROM node:20-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt /app/requirements.txt
COPY package.json package-lock.json /app/
COPY frontend/package.json frontend/package-lock.json /app/frontend/

RUN python3 -m venv /opt/venv \
    && pip install --no-cache-dir -r /app/requirements.txt fastapi uvicorn \
    && npm --prefix /app ci \
    && npm --prefix /app/frontend ci