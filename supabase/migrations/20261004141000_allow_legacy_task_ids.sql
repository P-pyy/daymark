alter table public.tasks
  alter column id type text using id::text;
