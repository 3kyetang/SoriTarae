import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const styles = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

test("adds an ask tab to desktop and mobile navigation", () => {
  assert.match(page, /type Tab = "record" \| "history" \| "ask" \| "settings"/);
  assert.equal((page.match(/switchTab\("ask"\)/g) ?? []).length, 2);
  assert.match(page, /tab === "ask"[\s\S]*renderAsk\(\)/);
  assert.match(styles, /grid-template-columns: repeat\(4, 1fr\)/);
});

test("keeps diary questions authenticated and bounded in the UI", () => {
  assert.match(page, /!authUserId[\s\S]*내 일기에 질문하려면 먼저 로그인/);
  assert.match(page, /ragQuestion\.trim\(\)\.length < 2/);
  assert.match(page, /event\.target\.value\.slice\(0, 500\)/);
  assert.match(page, /maxLength=\{500\}/);
});

test("calls the RAG API without exposing server credentials", () => {
  assert.match(page, /fetch\("\/api\/rag\/answer"/);
  assert.match(page, /JSON\.stringify\(\{ question \}\)/);
  assert.match(page, /isRagAnswer\(payload\)/);
  assert.doesNotMatch(page, /GEMINI_API_KEY|EMBEDDING_SERVICE_TOKEN/);
});

test("renders grounded answers and their source diaries", () => {
  assert.match(page, /ragAnswer\.answer/);
  assert.match(page, /ragAnswer\.grounded/);
  assert.match(page, /ragAnswer\.sources\.map/);
  assert.match(page, /openRagSource\(source\)/);
  assert.match(page, /entries\.find\(\(candidate\) => candidate\.id === source\.diaryId\)/);
  assert.match(page, /retrievalMethod === "recent"/);
});

test("provides loading, empty, and retryable error states", () => {
  assert.match(page, /ragRequestState === "idle"/);
  assert.match(page, /ragRequestState === "loading"/);
  assert.match(page, /ragRequestState === "error"/);
  assert.match(page, /onClick=\{\(\) => void askDiaryQuestion\(\)\}/);
  assert.match(page, /ragRequestAbortRef\.current\?\.abort\(\)/);
});
