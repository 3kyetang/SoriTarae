-- DEVELOPMENT ONLY: this permanently deletes every diary row.
-- Keep rollback scripts outside supabase/migrations so they are never applied
-- automatically by `supabase db push`.

begin;

drop table if exists public.diaries;
drop function if exists public.handle_diaries_updated_at();

commit;
