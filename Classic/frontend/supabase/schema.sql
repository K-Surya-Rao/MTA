create table if not exists public.journal_stores (
    user_id uuid not null references auth.users(id) on delete cascade,
    market text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (user_id, market)
);

alter table public.journal_stores enable row level security;

drop policy if exists "Users can read their own journal stores" on public.journal_stores;
create policy "Users can read their own journal stores"
on public.journal_stores
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own journal stores" on public.journal_stores;
create policy "Users can insert their own journal stores"
on public.journal_stores
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own journal stores" on public.journal_stores;
create policy "Users can update their own journal stores"
on public.journal_stores
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists journal_stores_updated_at_idx
on public.journal_stores (updated_at desc);
