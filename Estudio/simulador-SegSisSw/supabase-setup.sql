-- Ejecutar una sola vez en Supabase > SQL Editor.
create table if not exists public.study_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.study_sync enable row level security;

drop policy if exists "Users can read their own study state" on public.study_sync;
create policy "Users can read their own study state"
  on public.study_sync for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own study state" on public.study_sync;
create policy "Users can insert their own study state"
  on public.study_sync for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own study state" on public.study_sync;
create policy "Users can update their own study state"
  on public.study_sync for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Habilitar Realtime para avisar a otros dispositivos cuando cambia el progreso.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'study_sync'
  ) then
    alter publication supabase_realtime add table public.study_sync;
  end if;
end $$;
