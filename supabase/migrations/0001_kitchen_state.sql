-- Midnight Snack Club — synced fridge state.
--
-- One row per user holding the whole client state as a JSON document. The
-- server never queries inside it, so a document is the right shape and keeps
-- this to a single table.
--
-- Row-level security is the real security boundary for this app. The
-- publishable key ships publicly in the browser bundle (by design — that is
-- what it is for), so these policies are the only thing stopping one signed-in
-- user from reading or writing another's fridge. Do not disable them.
--
-- Re-runnable: safe to apply more than once.

create table if not exists public.kitchen_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.kitchen_state enable row level security;

-- Postgres has no "create policy if not exists", so drop first.
drop policy if exists "kitchen_state: read own row"   on public.kitchen_state;
drop policy if exists "kitchen_state: insert own row" on public.kitchen_state;
drop policy if exists "kitchen_state: update own row" on public.kitchen_state;
drop policy if exists "kitchen_state: delete own row" on public.kitchen_state;

-- One policy per verb, each scoped to the caller's own row.
--
-- Two details that matter:
--   `to authenticated` — the anon role gets no policy at all, so a signed-out
--   client cannot touch this table even to count rows.
--   `(select auth.uid())` — wrapping it lets Postgres evaluate the call once
--   per statement instead of once per row, which is Supabase's documented
--   guidance and matters as a fridge grows.

create policy "kitchen_state: read own row"
  on public.kitchen_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "kitchen_state: insert own row"
  on public.kitchen_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "kitchen_state: update own row"
  on public.kitchen_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Lets someone clear their synced copy without deleting the account.
create policy "kitchen_state: delete own row"
  on public.kitchen_state
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Keep updated_at honest even if a client forgets to send it.
--
-- SECURITY INVOKER, not DEFINER: this only assigns a field on the NEW record
-- and needs no elevated rights. It also lives in the exposed `public` schema,
-- so PostgREST would otherwise publish it as a callable RPC — hence the
-- revokes. A trigger fires regardless of EXECUTE grants, so nothing legitimate
-- depends on them. (Supabase's database linter flags both of these; this
-- version comes up clean.)
create or replace function public.touch_kitchen_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_kitchen_state() from public;
revoke all on function public.touch_kitchen_state() from anon;
revoke all on function public.touch_kitchen_state() from authenticated;

drop trigger if exists kitchen_state_touch on public.kitchen_state;

create trigger kitchen_state_touch
  before update on public.kitchen_state
  for each row
  execute function public.touch_kitchen_state();
