import "server-only";

export const EMBEDDING_MODEL = "jhgan/ko-sroberta-multitask";
export const EMBEDDING_DIMENSIONS = 768;

function isHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function isUsableToken(value: string | undefined) {
  return Boolean(
    value &&
      value.length >= 32 &&
      !value.startsWith("replace_") &&
      !/\s/.test(value),
  );
}

export function isEmbeddingServiceConfigured() {
  return (
    isHttpUrl(process.env.EMBEDDING_SERVICE_URL) &&
    isUsableToken(process.env.EMBEDDING_SERVICE_TOKEN)
  );
}

export function getEmbeddingServiceConfig() {
  if (!isEmbeddingServiceConfigured()) {
    throw new Error(
      "Embedding service environment variables are missing or invalid.",
    );
  }

  return {
    url: process.env.EMBEDDING_SERVICE_URL!.replace(/\/+$/, ""),
    token: process.env.EMBEDDING_SERVICE_TOKEN!,
  };
}
