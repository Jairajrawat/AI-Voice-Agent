FROM python:3.11-bullseye

# System deps often needed by vocode transcribers/synthesizers.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg libasound-dev libsndfile1-dev \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml /app/pyproject.toml
COPY poetry.lock /app/poetry.lock
COPY README.md /app/README.md

RUN pip install --no-cache-dir --upgrade pip poetry \
  && poetry config virtualenvs.create false \
  && poetry install --no-interaction --no-ansi --only main --no-root

# Copy library and bridge app code.
COPY vocode /app/vocode
COPY apps/node_bridge /app/apps/node_bridge

ENV PORT=3000
EXPOSE 3000

# Bind to Render's injected PORT when present.
CMD ["sh", "-c", "uvicorn apps.node_bridge.main:app --host 0.0.0.0 --port ${PORT:-3000}"]
