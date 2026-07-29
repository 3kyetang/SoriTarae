import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260728000000_create_diaries.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollback = await readFile(
  new URL(
    "../supabase/rollbacks/20260728000000_drop_diaries.sql",
    import.meta.url,
  ),
  "utf8",
);
const manualStyleMigration = await readFile(
  new URL(
    "../supabase/migrations/20260728010000_add_manual_diary_style.sql",
    import.meta.url,
  ),
  "utf8",
);

test("creates the diaries schema required by SoriTarae", () => {
  assert.match(migration, /create table public\.diaries/i);
  assert.match(
    migration,
    /user_id uuid not null default auth\.uid\(\)[\s\S]*references auth\.users\(id\) on delete cascade/i,
  );
  assert.match(
    migration,
    /keywords text\[\] not null default '\{\}'/i,
  );
  assert.match(migration, /style in \('basic', 'focus'\)/i);
  assert.match(
    migration,
    /create index idx_diaries_user_created[\s\S]*user_id, created_at desc/i,
  );
});

test("locks diaries to authenticated owners with four RLS policies", () => {
  assert.match(
    migration,
    /alter table public\.diaries enable row level security/i,
  );
  assert.match(
    migration,
    /revoke all privileges on table public\.diaries from anon/i,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete on table public\.diaries to authenticated/i,
  );

  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(
      migration,
      new RegExp(
        `create policy "diaries_${operation}_policy"[\\s\\S]*for ${operation}[\\s\\S]*to authenticated`,
        "i",
      ),
    );
  }

  assert.doesNotMatch(migration, /to anon/i);
  assert.equal(
    (migration.match(/\(select auth\.uid\(\)\) = user_id/gi) ?? []).length,
    5,
  );
});

test("extends diary styles for user-authored entries", () => {
  assert.match(
    manualStyleMigration,
    /drop constraint if exists diaries_style_check/i,
  );
  assert.match(
    manualStyleMigration,
    /style in \('basic', 'focus', 'manual'\)/i,
  );
});

test("keeps destructive rollback outside automatic migrations", () => {
  assert.match(rollback, /development only/i);
  assert.match(rollback, /drop table if exists public\.diaries/i);
  assert.doesNotMatch(migration, /drop table/i);
});
