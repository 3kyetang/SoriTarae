import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const generateRoute = await readFile(
  new URL("../app/api/generate/route.ts", import.meta.url),
  "utf8",
);

test("keeps the two supported diary styles", () => {
  assert.match(page, /기본형/);
  assert.match(page, /핵심 요약/);
  assert.doesNotMatch(page, /3줄 요약/);
});

test("uses Vercel-safe audio and runtime limits", () => {
  assert.match(page, /const MAX_AUDIO_BYTES = 4 \* 1024 \* 1024/);
  assert.match(generateRoute, /export const runtime = "nodejs"/);
  assert.match(generateRoute, /export const maxDuration = 120/);
  assert.match(generateRoute, /const MAX_AUDIO_BYTES = 4 \* 1024 \* 1024/);
});

test("keeps the Gemini key server-only", () => {
  assert.match(generateRoute, /process\.env\.GEMINI_API_KEY/);
  assert.doesNotMatch(page, /GEMINI_API_KEY/);
  assert.doesNotMatch(page, /NEXT_PUBLIC_/);
});
