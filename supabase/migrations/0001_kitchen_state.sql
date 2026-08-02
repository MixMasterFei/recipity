-- Midnight Snack Club — synced fridge state.
--
-- One row per user holding the whole client state as a JSON document. The
-- server never queries inside it, so a document is the right shape and keeps
-- this to a single table.
--
-- Row-level security is the real security boundary for this app. The anon key
-- ships publicly in the browser bundle (by design — that is what it is for),
-- so these policies are the only thing stopping one signed-in user from
-- reading or writing another's fridge. Do not disable them.

create table if not exists public.kitchen_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.kitchen_state enable row level security;

-- One policy per verb, each scoped to the caller's own row. Postgres has no
-- "create policy if not exists", so drop first to keep this re-runnable.
drop policy if exists "kitchen_state: read own row"   on public.kitchen_state;
drop policy if exists "kitchen_state: insert own row" on public.kitchen_state;
drop policy if exists "kitchen_state: update own row" on public.kitchen_state;
drop policy if exists "kitchen_state: delete own row" on public.kitchen_state;

create policy "kitchen_state: read own row"
  on public.kitchen_state
  for select
  using (auth.uid() = user_id);

create policy "kitchen_state: insert own row"
  on public.kitchen_state
  for insert
  with check (auth.uid() = user_id);

create policy "kitchen_state: update own row"
  on public.kitchen_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Lets someone clear their synced copy without deleting the account.
create policy "kitchen_state: delete own row"
  on public.kitchen_state
  for delete
  using (auth.uid() = user_id);

-- Keep updated_at honest even if a client forgets to send it.
create or replace function public.touch_kitchen_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kitchen_state_touch on public.kitchen_state;

create trigger kitchen_state_touch
  before update on public.kitchen_state
  for each row
  execute function public.touch_kitchen_state();
