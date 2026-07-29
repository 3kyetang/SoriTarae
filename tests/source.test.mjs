import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const generateRoute = await readFile(
  new URL("../app/api/generate/route.ts", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const supabaseProxy = await readFile(
  new URL("../lib/supabase/proxy.ts", import.meta.url),
  "utf8",
);
const envExample = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);

test("keeps the two supported diary styles", () => {
  assert.match(page, /기본형/);
  assert.match(page, /핵심 요약/);
  assert.doesNotMatch(page, /3줄 요약/);
  assert.match(
    page,
    /useState<GeneratedDiaryStyle>\("basic"\)/,
  );
});

test("uses the SoriTarae product name", () => {
  assert.match(page, /SoriTarae/);
  assert.doesNotMatch(page, />VoiceLog</);
  assert.equal(packageJson.name, "soritarae");
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

test("uses Supabase SSR with validated proxy sessions", () => {
  assert.equal(packageJson.dependencies["@supabase/ssr"], "^0.12.3");
  assert.equal(packageJson.dependencies["@supabase/supabase-js"], "^2.110.9");
  assert.match(supabaseProxy, /supabase\.auth\.getClaims\(\)/);
  assert.doesNotMatch(supabaseProxy, /supabase\.auth\.getSession\(\)/);
});

test("documents only the public Supabase browser credentials", () => {
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_URL=/);
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/);
  assert.doesNotMatch(envExample, /SERVICE_ROLE/i);
  assert.doesNotMatch(envExample, /SECRET_KEY/i);
});
