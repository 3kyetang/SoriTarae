import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  isEmbeddingServiceConfigured,
} from "@/lib/embeddings/config";
import { getEmbeddingServiceHealth } from "@/lib/embeddings/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export async function GET() {
  if (!isEmbeddingServiceConfigured()) {
    return Response.json(
      {
        configured: false,
        available: false,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  try {
    const health = await getEmbeddingServiceHealth();
    return Response.json(
      {
        configured: true,
        available: health.ready,
        model: health.model,
        dimensions: health.dimensions,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return Response.json(
      {
        configured: true,
        available: false,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
