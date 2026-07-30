from __future__ import annotations

import asyncio
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator
from sentence_transformers import SentenceTransformer


SERVICE_DIR = Path(__file__).resolve().parent
load_dotenv(SERVICE_DIR / ".env.local")

MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL",
    "jhgan/ko-sroberta-multitask",
).strip()
MODEL_DIMENSIONS = 768
MAX_TEXTS_PER_REQUEST = 32
MAX_TEXT_LENGTH = 4_000

bearer_scheme = HTTPBearer(auto_error=False)
model: SentenceTransformer | None = None


def configured_token() -> str:
    token = os.getenv("EMBEDDING_SERVICE_TOKEN", "").strip()
    if len(token) < 32 or token.startswith("replace_"):
        raise RuntimeError(
            "EMBEDDING_SERVICE_TOKEN must contain at least 32 random characters."
        )
    return token


def load_model() -> SentenceTransformer:
    device = os.getenv("EMBEDDING_DEVICE", "cpu").strip() or "cpu"
    loaded_model = SentenceTransformer(MODEL_NAME, device=device)
    dimensions = loaded_model.get_sentence_embedding_dimension()
    if dimensions != MODEL_DIMENSIONS:
        raise RuntimeError(
            f"{MODEL_NAME} returned {dimensions} dimensions; "
            f"expected {MODEL_DIMENSIONS}."
        )
    return loaded_model


@asynccontextmanager
async def lifespan(_: FastAPI):
    global model
    configured_token()
    model = await asyncio.to_thread(load_model)
    yield
    model = None


app = FastAPI(
    title="SoriTarae Embedding Service",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


def require_service_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    expected = configured_token()
    received = credentials.credentials if credentials else ""
    if (
        not credentials
        or credentials.scheme.lower() != "bearer"
        or not secrets.compare_digest(received, expected)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


class EmbedRequest(BaseModel):
    texts: list[str] = Field(
        min_length=1,
        max_length=MAX_TEXTS_PER_REQUEST,
    )

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, texts: list[str]) -> list[str]:
        cleaned: list[str] = []
        for text in texts:
            normalized = text.strip()
            if not normalized:
                raise ValueError("texts cannot contain empty values")
            if len(normalized) > MAX_TEXT_LENGTH:
                raise ValueError(
                    f"each text must be {MAX_TEXT_LENGTH} characters or fewer"
                )
            cleaned.append(normalized)
        return cleaned


class HealthResponse(BaseModel):
    ready: bool
    model: str
    dimensions: int


class EmbedResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: list[list[float]]


@app.get(
    "/health",
    response_model=HealthResponse,
    dependencies=[Depends(require_service_token)],
)
async def health() -> HealthResponse:
    return HealthResponse(
        ready=model is not None,
        model=MODEL_NAME,
        dimensions=MODEL_DIMENSIONS,
    )


def encode_texts(texts: list[str]) -> list[list[float]]:
    if model is None:
        raise RuntimeError("Embedding model is not ready.")

    vectors: Any = model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    if vectors.ndim != 2 or vectors.shape[1] != MODEL_DIMENSIONS:
        raise RuntimeError("Embedding model returned an unexpected shape.")
    return vectors.tolist()


@app.post(
    "/embed",
    response_model=EmbedResponse,
    dependencies=[Depends(require_service_token)],
)
async def embed(payload: EmbedRequest) -> EmbedResponse:
    vectors = await run_in_threadpool(encode_texts, payload.texts)
    return EmbedResponse(
        model=MODEL_NAME,
        dimensions=MODEL_DIMENSIONS,
        embeddings=vectors,
    )
