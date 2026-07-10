# CodeCanvas FastAPI backend — container image for Render (free Docker web service).
# Build context is the backend/ directory (set Render "Root Directory" = backend).
#
# The backend is an orchestrator: it calls Roboflow (detection) and Gemini (codegen)
# over the network, so there is NO torch / no local GPU model here. The only heavy
# local dependency is Playwright Chromium, used solely by the optional /api/fidelity
# self-check. If the host is memory-starved, set FIDELITY_ENABLED=false at runtime —
# the endpoint 503s cleanly and nothing else is affected.

FROM python:3.11-slim

# Keep Python lean and unbuffered so Render's log stream is live.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Install Python deps first so this layer caches across code-only changes.
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Install Chromium + its system libraries for the fidelity render step.
# --with-deps runs apt-get for the OS libs (fonts, libnss3, libgbm, ...).
# Remove this line if you want a slimmer image without fidelity support.
RUN python -m playwright install --with-deps chromium

# App source last — the layer that changes most often.
COPY . .

# Render injects $PORT. Default to 8000 for local `docker run`.
ENV PORT=8000
EXPOSE 8000

# Shell form so ${PORT} expands. Single worker keeps memory low on the free tier.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1
