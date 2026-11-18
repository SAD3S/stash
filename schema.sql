-- À coller dans Supabase > SQL Editor > Run
create table items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  url text not null,
  title text,
  type text not null check (type in ('link', 'video')),
  folder text default '',
  tags text[] default '{}',
  fav boolean default false,
  thumb text default '',
  created bigint not null
);

-- Chacun ne voit et ne modifie que ses propres liens
alter table items enable row level security;
create policy "own items" on items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table folders (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  primary key (user_id, name)
);
alter table folders enable row level security;
create policy "own folders" on folders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table items add column seen boolean default false, add column opened bigint default 0;

alter table items add column mins int;
alter table items add column if not exists note text default '';

create table if not exists shares (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  folder text not null,
  unique (user_id, folder)
);
alter table shares enable row level security;
create policy "own shares" on shares for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function shared_folder(t text)
returns table (folder text, title text, url text, type text, thumb text, mins int, note text, created bigint)
language sql security definer set search_path = public as $$
  select s.folder, i.title, i.url, i.type, i.thumb, i.mins, i.note, i.created
  from shares s left join items i on i.user_id = s.user_id and i.folder = s.folder
  where s.token = t order by i.created desc
$$;
revoke all on function shared_folder(text) from public;
grant execute on function shared_folder(text) to anon, authenticated;

create table if not exists push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  sub jsonb not null
);
alter table push_subs enable row level security;
create policy "own subs" on push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('stash-weekly', '0 8 * * 6', $$
  select net.http_post(url := 'https://pmtjifjduepxbaxvrpud.supabase.co/functions/v1/weekly',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type', 'application/json'), body := '{}'::jsonb)
$$);
