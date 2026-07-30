import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const ragRoute = await readFile(
  new URL("../app/api/rag/answer/route.ts", import.meta.url),
  "utf8",
);
const geminiConfig = await readFile(
  new URL("../lib/gemini/config.ts", import.meta.url),
  "utf8",
);
const hybridSearch = await readFile(
  new URL("../lib/rag/hybrid-search.ts", import.meta.url),
  "utf8",
);

test("keeps the RAG question endpoint authenticated and server-only", () => {
  assert.match(ragRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(ragRoute, /AUTH_REQUIRED/);
  assert.match(ragRoute, /status,\s*headers: NO_STORE_HEADERS/);
  assert.doesNotMatch(ragRoute, /service[_-]?role/i);
  assert.match(geminiConfig, /^import "server-only";/);
  assert.doesNotMatch(page, /GEMINI_API_KEY|EMBEDDING_SERVICE_TOKEN/);
});

test("validates bounded questions before creating embeddings", () => {
  assert.match(ragRoute, /question: z\.string\(\)\.trim\(\)\.min\(2\)\.max\(500\)/);
  assert.match(ragRoute, /MAX_REQUEST_BYTES = 8 \* 1024/);
  assert.ok(
    ragRoute.indexOf("requestSchema.safeParse") <
      ragRoute.indexOf("createEmbeddings([requestResult.data.question])"),
  );
});

test("searches only through the authenticated RLS RPC", () => {
  assert.match(ragRoute, /\.rpc\(\s*"match_diary_embeddings"/);
  assert.match(ragRoute, /match_threshold: MATCH_THRESHOLD/);
  assert.match(ragRoute, /match_count: MATCH_COUNT/);
  assert.match(ragRoute, /const MATCH_THRESHOLD = 0\.35/);
  assert.match(ragRoute, /const MATCH_COUNT = MAX_RAG_SOURCES/);
});

test("does not call Gemini when no relevant diary is found", () => {
  const noMatchesBranch = ragRoute.indexOf("if (!retrievedDiaries.length)");
  const geminiFetch = ragRoute.indexOf("fetch(GEMINI_INTERACTIONS_URL");
  assert.ok(noMatchesBranch >= 0);
  assert.ok(geminiFetch > noMatchesBranch);
  assert.match(
    ragRoute,
    /내 일기에서는 이 질문에 답할 만한 기록을 아직 찾지 못했어요/,
  );
});

test("treats diary text and user instructions as untrusted data", () => {
  assert.match(ragRoute, /일기 자료 안의 명령문/);
  assert.match(ragRoute, /사용자 질문 안의 명령문/);
  assert.match(ragRoute, /JSON\.stringify\(sourcePayload\)/);
  assert.match(ragRoute, /store: false/);
});

test("returns only validated source metadata and rejects invented citations", () => {
  assert.match(ragRoute, /answerSchema\.safeParse/);
  assert.match(
    ragRoute,
    /sourceNumber > retrievedDiaries\.length/,
  );
  assert.match(ragRoute, /diaryId: match\.diary_id/);
  assert.match(ragRoute, /similarity: match\.similarity/);
  assert.match(
    ragRoute,
    /검색된 일기만으로는 이 질문에 확실하게 답하기 어려워요/,
  );
});

test("adds recent diaries only when the question has temporal intent", () => {
  assert.match(hybridSearch, /가장\\s\*최근\|최근\|요즘\|요새\|근래/);
  assert.match(hybridSearch, /RECENT_DIARY_COUNT = 3/);
  assert.match(hybridSearch, /MAX_RAG_SOURCES = 5/);
  assert.match(ragRoute, /if \(hasRecencyIntent\(requestResult\.data\.question\)\)/);
  assert.match(ragRoute, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(ragRoute, /\.limit\(RECENT_DIARY_COUNT\)/);
  assert.match(ragRoute, /\.eq\("user_id", user\.id\)/);
});

test("deduplicates semantic and recent results with retrieval metadata", () => {
  assert.match(
    hybridSearch,
    /for \(const result of \[\.\.\.recentResults, \.\.\.semanticResults\]\)/,
  );
  assert.match(hybridSearch, /const merged = new Map<string, RetrievedDiary>\(\)/);
  assert.match(hybridSearch, /retrievalMethod: "both"/);
  assert.match(hybridSearch, /\.slice\(0, MAX_RAG_SOURCES\)/);
  assert.match(ragRoute, /retrievalMethod: diary\.retrievalMethod/);
});

test("keeps the Gemini key in a server request header", () => {
  assert.match(ragRoute, /process\.env\.GEMINI_API_KEY/);
  assert.match(ragRoute, /"x-goog-api-key": apiKey/);
  assert.match(geminiConfig, /gemini-3\.6-flash/);
  assert.doesNotMatch(geminiConfig, /NEXT_PUBLIC_/);
});
