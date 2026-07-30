import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pythonService = await readFile(
  new URL("../embedding-service/app.py", import.meta.url),
  "utf8",
);
const requirements = await readFile(
  new URL("../embedding-service/requirements.txt", import.meta.url),
  "utf8",
);
const modelVerification = await readFile(
  new URL("../embedding-service/verify_model.py", import.meta.url),
  "utf8",
);
const embeddingConfig = await readFile(
  new URL("../lib/embeddings/config.ts", import.meta.url),
  "utf8",
);
const embeddingClient = await readFile(
  new URL("../lib/embeddings/client.ts", import.meta.url),
  "utf8",
);
const statusRoute = await readFile(
  new URL("../app/api/embeddings/status/route.ts", import.meta.url),
  "utf8",
);
const envExample = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);

test("pins the local Korean embedding runtime", () => {
  assert.match(requirements, /^fastapi\[standard\]==0\.139\.2$/m);
  assert.match(requirements, /^sentence-transformers==5\.6\.0$/m);
  assert.match(pythonService, /jhgan\/ko-sroberta-multitask/);
  assert.match(pythonService, /MODEL_DIMENSIONS = 768/);
  assert.match(pythonService, /normalize_embeddings=True/);
  assert.match(modelVerification, /dimensions != MODEL_DIMENSIONS/);
  assert.match(modelVerification, /normalized=/);
});

test("protects every local embedding endpoint with a service token", () => {
  assert.match(pythonService, /HTTPBearer\(auto_error=False\)/);
  assert.match(pythonService, /secrets\.compare_digest\(received, expected\)/);
  assert.match(
    pythonService,
    /dependencies=\[Depends\(require_service_token\)\]/g,
  );
  assert.match(pythonService, /MAX_TEXTS_PER_REQUEST = 32/);
  assert.match(pythonService, /MAX_TEXT_LENGTH = 4_000/);
});

test("keeps embedding credentials server-only", () => {
  assert.match(embeddingConfig, /^import "server-only";/);
  assert.match(embeddingClient, /^import "server-only";/);
  assert.match(embeddingConfig, /process\.env\.EMBEDDING_SERVICE_TOKEN/);
  assert.match(embeddingClient, /headers\.set\("Authorization", `Bearer \$\{token\}`\)/);
  assert.match(envExample, /^EMBEDDING_SERVICE_URL=/m);
  assert.match(envExample, /^EMBEDDING_SERVICE_TOKEN=/m);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_EMBEDDING/);
  assert.doesNotMatch(statusRoute, /EMBEDDING_SERVICE_TOKEN/);
});

test("validates the model identity and every 768-dimensional vector", () => {
  assert.match(
    embeddingConfig,
    /EMBEDDING_MODEL = "jhgan\/ko-sroberta-multitask"/,
  );
  assert.match(embeddingConfig, /EMBEDDING_DIMENSIONS = 768/);
  assert.match(
    embeddingClient,
    /z\.array\(z\.number\(\)\.finite\(\)\)\.length\(EMBEDDING_DIMENSIONS\)/,
  );
  assert.match(
    embeddingClient,
    /payload\.embeddings\.length !== texts\.length/,
  );
});
