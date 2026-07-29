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
const embeddingsMigration = await readFile(
  new URL(
    "../supabase/migrations/20260729000000_create_diary_embeddings.sql",
    import.meta.url,
  ),
  "utf8",
);
const embeddingsRollback = await readFile(
  new URL(
    "../supabase/rollbacks/20260729000000_drop_diary_embeddings.sql",
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

test("prepares 768-dimensional Korean diary embeddings", () => {
  assert.match(
    embeddingsMigration,
    /create extension if not exists vector[\s\S]*with schema extensions/i,
  );
  assert.match(
    embeddingsMigration,
    /create table public\.diary_embeddings/i,
  );
  assert.match(
    embeddingsMigration,
    /diary_id uuid primary key[\s\S]*references public\.diaries\(id\) on delete cascade/i,
  );
  assert.match(
    embeddingsMigration,
    /embedding extensions\.vector\(768\) not null/i,
  );
  assert.match(
    embeddingsMigration,
    /default 'jhgan\/ko-sroberta-multitask'/i,
  );
  assert.match(embeddingsMigration, /content_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
});

test("keeps vector retrieval private to the authenticated diary owner", () => {
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(
      embeddingsMigration,
      new RegExp(
        `create policy "diary_embeddings_${operation}_policy"[\\s\\S]*for ${operation}[\\s\\S]*to authenticated`,
        "i",
      ),
    );
  }

  assert.match(
    embeddingsMigration,
    /create function public\.match_diary_embeddings[\s\S]*security invoker/i,
  );
  assert.match(
    embeddingsMigration,
    /where diaries\.user_id = \(select auth\.uid\(\)\)/i,
  );
  assert.equal(
    (
      embeddingsMigration.match(
        /operator\(extensions\.<=>\)/gi,
      ) ?? []
    ).length,
    3,
  );
  assert.match(
    embeddingsMigration,
    /limit least\(greatest\(match_count, 1\), 20\)/i,
  );
  assert.match(
    embeddingsMigration,
    /revoke all on function public\.match_diary_embeddings[\s\S]*from public, anon/i,
  );
});

test("invalidates stale vectors when a diary changes", () => {
  assert.match(
    embeddingsMigration,
    /create trigger invalidate_embedding_after_diary_update[\s\S]*after update of title, body, transcript_summary/i,
  );
  assert.match(
    embeddingsMigration,
    /delete from public\.diary_embeddings[\s\S]*where diary_id = new\.id/i,
  );
  assert.match(embeddingsRollback, /drop table if exists public\.diary_embeddings/i);
  assert.doesNotMatch(embeddingsRollback, /drop extension/i);
});

test("keeps destructive rollback outside automatic migrations", () => {
  assert.match(rollback, /development only/i);
  assert.match(rollback, /drop table if exists public\.diaries/i);
  assert.doesNotMatch(migration, /drop table/i);
});
