import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const diaryContent = await readFile(
  new URL("../lib/embeddings/diary-content.ts", import.meta.url),
  "utf8",
);
const diaryIndexing = await readFile(
  new URL("../lib/embeddings/diary-indexing.ts", import.meta.url),
  "utf8",
);
const singleRoute = await readFile(
  new URL(
    "../app/api/diaries/[diaryId]/embedding/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const batchRoute = await readFile(
  new URL("../app/api/diaries/embeddings/route.ts", import.meta.url),
  "utf8",
);

test("builds deterministic bounded diary embedding content", () => {
  assert.match(diaryContent, /^import "server-only";/);
  assert.match(diaryContent, /createHash\("sha256"\)/);
  assert.match(diaryContent, /\.slice\(0, MAX_EMBEDDING_TEXT_LENGTH\)/);
  assert.match(diaryContent, /제목:/);
  assert.match(diaryContent, /내용:/);
});

test("indexes at most 32 changed diaries and skips matching hashes", () => {
  assert.match(diaryIndexing, /MAX_DIARIES_PER_SYNC = 32/);
  assert.match(
    diaryIndexing,
    /existingHashes\.get\(diary\.diaryId\) !== diary\.contentHash/,
  );
  assert.match(diaryIndexing, /createEmbeddings\(/);
  assert.match(diaryIndexing, /\.upsert\(stableRows, \{ onConflict: "diary_id" \}\)/);
  assert.match(diaryIndexing, /embedding_model: EMBEDDING_MODEL/);
});

test("rejects anonymous and cross-owner single diary indexing", () => {
  assert.match(singleRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(singleRoute, /status: 401/);
  assert.match(singleRoute, /\.eq\("id", parsedParams\.data\.diaryId\)/);
  assert.match(singleRoute, /\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(singleRoute, /service[_-]?role/i);
});

test("batch indexing reads only the authenticated user's diaries", () => {
  assert.match(batchRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(batchRoute, /\.eq\("user_id", user\.id\)/);
  assert.match(batchRoute, /indexDiaries\(/);
  assert.doesNotMatch(batchRoute, /service[_-]?role/i);
});

test("syncs saved and existing cloud diaries without blocking local diaries", () => {
  assert.match(
    page,
    /\/api\/diaries\/\$\{encodeURIComponent\(diaryId\)\}\/embedding/,
  );
  assert.match(page, /fetch\("\/api\/diaries\/embeddings"/);
  assert.match(page, /requestIndex < 4/);
  assert.match(page, /saved-without-embedding/);
  assert.match(page, /void synchronizeAllDiaryEmbeddings\(\)/);
});

test("checks diary version again before storing generated vectors", () => {
  assert.match(diaryIndexing, /\.select\("id, updated_at"\)/);
  assert.match(
    diaryIndexing,
    /latestVersions\.get\(diary\.diaryId\) !== diary\.updatedAt/,
  );
});
