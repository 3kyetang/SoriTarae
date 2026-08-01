begin;

create table public.diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  mood text,
  keywords text[] not null default '{}',
  style text not null check (style in ('basic', 'focus')),
  transcript_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_diaries_user_created
  on public.diaries (user_id, created_at desc);

create function public.handle_diaries_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_diaries_updated_at
  before update on public.diaries
  for each row
  execute function public.handle_diaries_updated_at();

alter table public.diaries enable row level security;

revoke all privileges on table public.diaries from anon;
grant select, insert, update, delete on table public.diaries to authenticated;

revoke execute on function public.handle_diaries_updated_at()
  from public, anon, authenticated;

create policy "diaries_select_policy"
  on public.diaries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "diaries_insert_policy"
  on public.diaries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "diaries_update_policy"
  on public.diaries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "diaries_delete_policy"
  on public.diaries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
