-- Ritmo · respaldo de la cuenta.
-- Una fila por usuario con todo su estado (tareas, hábitos y ajustes).
-- Solo el dueño puede leerla o escribirla (Row Level Security).

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "own state select" on public.user_state;
create policy "own state select" on public.user_state
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own state insert" on public.user_state;
create policy "own state insert" on public.user_state
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own state update" on public.user_state;
create policy "own state update" on public.user_state
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own state delete" on public.user_state;
create policy "own state delete" on public.user_state
  for delete to authenticated using (user_id = auth.uid());

-- ─── Perfiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null default '',
  gender      text not null default 'm' check (gender in ('m', 'f')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cualquier usuario con sesión puede buscar perfiles por nombre de usuario (para agregar amigos).
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);

drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ─── Amistades ─────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  requester   uuid not null references public.profiles (id) on delete cascade,
  addressee   uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

alter table public.friendships enable row level security;

drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "send friend requests" on public.friendships;
create policy "send friend requests" on public.friendships
  for insert to authenticated with check (requester = auth.uid() and status = 'pending');

-- Solo quien recibe la solicitud puede aceptarla.
drop policy if exists "accept received requests" on public.friendships;
create policy "accept received requests" on public.friendships
  for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());

-- Cualquiera de los dos puede eliminar la amistad o la solicitud.
drop policy if exists "remove friendships" on public.friendships;
create policy "remove friendships" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- ─── Avance diario (lo único que ven los amigos) ───────────────────────────
create table if not exists public.day_progress (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  day           date not null,
  done_minutes  integer not null default 0 check (done_minutes >= 0),
  total_minutes integer not null default 0 check (total_minutes >= 0),
  focus_until   timestamptz,           -- si está en foco ahora, hasta cuándo
  updated_at    timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.day_progress enable row level security;

drop policy if exists "own progress" on public.day_progress;
create policy "own progress" on public.day_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "friends read progress" on public.day_progress;
create policy "friends read progress" on public.day_progress
  for select to authenticated using (public.are_friends(auth.uid(), user_id));

-- Ranking en vivo entre amigos (la app se suscribe con Supabase Realtime).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'day_progress'
  ) then
    alter publication supabase_realtime add table public.day_progress;
  end if;
end $$;

-- Las tablas habits/habit_checks de esta versión se eliminaron en 1.6: los hábitos viajan en user_state.
