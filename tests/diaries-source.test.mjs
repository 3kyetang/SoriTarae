import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const diaries = await readFile(
  new URL("../lib/diaries.ts", import.meta.url),
  "utf8",
);

test("loads authenticated diary history from Supabase", () => {
  assert.match(page, /\.from\("diaries"\)[\s\S]*\.select\(/);
  assert.match(page, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(page, /authUserId && supabase/);
  assert.match(page, /diaryRowToEntry/);
});

test("keeps anonymous history in local storage without mixing cloud entries", () => {
  assert.match(page, /const HISTORY_KEY = "soritarae\.entries\.v1"/);
  assert.match(page, /const LEGACY_HISTORY_KEY = "voicelog\.entries\.v1"/);
  assert.match(
    page,
    /if \(!authReady \|\| authUserId \|\| !historyHydratedRef\.current\) return/,
  );
  assert.match(page, /window\.localStorage\.setItem\(HISTORY_KEY/);
});

test("marks direct writing as manual without sending it to the AI route", () => {
  assert.match(page, /style: "manual"/);
  assert.match(page, /label: "직접 작성"/);
  assert.match(diaries, /DiaryStyle = "basic" \| "focus" \| "manual"/);
});

test("persists authenticated diary CRUD through owner-scoped queries", () => {
  assert.match(page, /\.upsert\(diaryEntryToRow\(currentDiary, authUserId\)/);
  assert.match(page, /\.delete\(\)[\s\S]*\.eq\("id", id\)[\s\S]*\.eq\("user_id", authUserId\)/);
  assert.match(page, /\.delete\(\)[\s\S]*\.eq\("user_id", authUserId\)/);
  assert.match(diaries, /user_id: userId/);
  assert.doesNotMatch(page, /service[_-]?role/i);
});

test("migrates local diaries only after explicit verified cloud upload", () => {
  assert.match(page, /const migrateLocalHistory = async/);
  assert.match(page, /ignoreDuplicates: true/);
  assert.match(page, /localEntriesToMigrate\.every\(\(entry\) => refreshedIds\.has\(entry\.id\)\)/);
  assert.match(
    page,
    /if \(!allMigrated\)[\s\S]*return;[\s\S]*window\.localStorage\.removeItem\(HISTORY_KEY\)/,
  );
  assert.match(page, /클라우드로 가져오기/);
  assert.match(page, /원본은 이 기기에 그대로 남아 있어요/);
});
