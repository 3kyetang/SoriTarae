-- DEVELOPMENT ONLY: manual rows are converted to basic before restoring the
-- previous constraint. Review existing data before running this script.

begin;

update public.diaries
set style = 'basic'
where style = 'manual';

alter table public.diaries
  drop constraint if exists diaries_style_check;

alter table public.diaries
  add constraint diaries_style_check
  check (style in ('basic', 'focus'));

commit;
