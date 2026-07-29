begin;

create extension if not exists vector
  with schema extensions;

create table public.diary_embeddings (
  diary_id uuid primary key
    references public.diaries(id) on delete cascade,
  content text not null
    check (char_length(btrim(content)) > 0),
  content_hash text not null
    check (content_hash ~ '^[0-9a-f]{64}$'),
  embedding extensions.vector(768) not null,
  embedding_model text not null
    default 'jhgan/ko-sroberta-multitask',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diary_embeddings enable row level security;

revoke all privileges on table public.diary_embeddings from anon;
grant select, insert, update, delete
  on table public.diary_embeddings
  to authenticated;

create policy "diary_embeddings_select_policy"
  on public.diary_embeddings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.diaries
      where diaries.id = diary_embeddings.diary_id
        and diaries.user_id = (select auth.uid())
    )
  );

create policy "diary_embeddings_insert_policy"
  on public.diary_embeddings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.diaries
      where diaries.id = diary_embeddings.diary_id
        and diaries.user_id = (select auth.uid())
    )
  );

create policy "diary_embeddings_update_policy"
  on public.diary_embeddings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.diaries
      where diaries.id = diary_embeddings.diary_id
        and diaries.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.diaries
      where diaries.id = diary_embeddings.diary_id
        and diaries.user_id = (select auth.uid())
    )
  );

create policy "diary_embeddings_delete_policy"
  on public.diary_embeddings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.diaries
      where diaries.id = diary_embeddings.diary_id
        and diaries.user_id = (select auth.uid())
    )
  );

create function public.handle_diary_embeddings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_diary_embeddings_updated_at
  before update on public.diary_embeddings
  for each row
  execute function public.handle_diary_embeddings_updated_at();

create function public.invalidate_diary_embedding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    old.title,
    old.body,
    old.transcript_summary
  ) is distinct from row(
    new.title,
    new.body,
    new.transcript_summary
  ) then
    delete from public.diary_embeddings
    where diary_id = new.id;
  end if;

  return new;
end;
$$;

create trigger invalidate_embedding_after_diary_update
  after update of title, body, transcript_summary
  on public.diaries
  for each row
  execute function public.invalidate_diary_embedding();

create function public.match_diary_embeddings(
  query_embedding extensions.vector(768),
  match_threshold real default 0.25,
  match_count integer default 5
)
returns table (
  diary_id uuid,
  title text,
  content text,
  diary_created_at timestamptz,
  similarity real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    embeddings.diary_id,
    diaries.title,
    embeddings.content,
    diaries.created_at as diary_created_at,
    (
      1 - (
        embeddings.embedding
        operator(extensions.<=>)
        query_embedding
      )
    )::real as similarity
  from public.diary_embeddings as embeddings
  join public.diaries
    on diaries.id = embeddings.diary_id
  where diaries.user_id = (select auth.uid())
    and 1 - (
      embeddings.embedding
      operator(extensions.<=>)
      query_embedding
    )
      >= greatest(-1.0, least(match_threshold, 1.0))
  order by
    embeddings.embedding
    operator(extensions.<=>)
    query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_diary_embeddings(
  extensions.vector(768),
  real,
  integer
) from public, anon;

grant execute on function public.match_diary_embeddings(
  extensions.vector(768),
  real,
  integer
) to authenticated;

revoke execute on function public.handle_diary_embeddings_updated_at()
  from public, anon, authenticated;
revoke execute on function public.invalidate_diary_embedding()
  from public, anon, authenticated;

commit;
