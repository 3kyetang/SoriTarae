-- DEVELOPMENT ONLY: this permanently deletes all stored diary embeddings.
-- It intentionally leaves the shared vector extension installed.

begin;

drop trigger if exists invalidate_embedding_after_diary_update
  on public.diaries;
drop function if exists public.invalidate_diary_embedding();

drop function if exists public.match_diary_embeddings(
  extensions.vector(768),
  real,
  integer
);

drop table if exists public.diary_embeddings;
drop function if exists public.handle_diary_embeddings_updated_at();

commit;
