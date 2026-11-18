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
