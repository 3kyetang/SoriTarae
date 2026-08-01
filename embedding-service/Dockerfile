FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/huggingface

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt

# Store the fixed model inside the image so production startup does not depend
# on a live Hugging Face download.
RUN python -c "from sentence_transformers import SentenceTransformer; model = SentenceTransformer('jhgan/ko-sroberta-multitask'); assert model.get_sentence_embedding_dimension() == 768"

COPY app.py .

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app /opt/huggingface

ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

USER appuser

EXPOSE 8080

CMD ["sh", "-c", "python -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}"]
