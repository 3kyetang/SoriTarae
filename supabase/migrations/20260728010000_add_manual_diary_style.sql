begin;

alter table public.diaries
  drop constraint if exists diaries_style_check;

alter table public.diaries
  add constraint diaries_style_check
  check (style in ('basic', 'focus', 'manual'));

commit;
