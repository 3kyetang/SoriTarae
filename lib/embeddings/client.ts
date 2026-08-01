import "server-only";

import { z } from "zod";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  getEmbeddingServiceConfig,
} from "./config";

const REQUEST_TIMEOUT_MS = 90_000;

const healthSchema = z.object({
  ready: z.boolean(),
  model: z.literal(EMBEDDING_MODEL),
  dimensions: z.literal(EMBEDDING_DIMENSIONS),
});

const embeddingSchema = z.object({
  model: z.literal(EMBEDDING_MODEL),
  dimensions: z.literal(EMBEDDING_DIMENSIONS),
  embeddings: z.array(
    z.array(z.number().finite()).length(EMBEDDING_DIMENSIONS),
  ),
});

async function embeddingServiceFetch(path: string, init?: RequestInit) {
  const { url, token } = getEmbeddingServiceConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  try {
    return await fetch(`${url}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getEmbeddingServiceHealth() {
  const response = await embeddingServiceFetch("/health");
  if (!response.ok) {
    throw new Error(`Embedding service health check failed: ${response.status}`);
  }
  return healthSchema.parse(await response.json());
}

export async function createEmbeddings(texts: string[]) {
  if (texts.length < 1 || texts.length > 32) {
    throw new Error("Embedding requests require between 1 and 32 texts.");
  }

  const response = await embeddingServiceFetch("/embed", {
    method: "POST",
    body: JSON.stringify({ texts }),
  });
  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }

  const payload = embeddingSchema.parse(await response.json());
  if (payload.embeddings.length !== texts.length) {
    throw new Error("Embedding service returned an unexpected vector count.");
  }
  return payload.embeddings;
}
