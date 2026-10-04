create table if not exists public.tasks (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb,
  updated_at bigint not null,
  is_deleted boolean not null default false,
  constraint tasks_deleted_payload_check check (is_deleted or payload is not null)
);

create index if not exists tasks_owner_updated_at_idx
  on public.tasks (owner_id, updated_at desc);

alter table public.tasks enable row level security;
revoke all on public.tasks from anon;
grant select, insert, update on public.tasks to authenticated;
grant all on public.tasks to service_role;

create policy "Users can view their own tasks"
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create their own tasks"
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update their own tasks"
  on public.tasks for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end
$$;

create table if not exists public.login_notices (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  claimed_at timestamptz,
  sent_at timestamptz,
  primary key (user_id, session_id)
);

alter table public.login_notices enable row level security;
revoke all on public.login_notices from public, anon, authenticated;
grant all on public.login_notices to service_role;
