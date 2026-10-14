-- MRitmo 1.8 · Salas con ranking propio.
--
-- Una sala es un grupo con nombre y un dueño. Sus miembros se ven el avance del
-- día y de la semana entre ellos (solo % y minutos, como entre amigos), aunque
-- no sean amigos entre sí: entrar a una sala es aceptar compartir eso con ella.
--
-- Cómo funciona:
--   1. Alguien crea la sala (queda como dueño y primer miembro).
--   2. Cualquier miembro invita a sus amigos (estado "invited").
--   3. El invitado acepta (pasa a "joined") o rechaza (se borra su fila).
--   4. Cualquiera sale borrando su fila. Si sale el dueño, la sala pasa al
--      miembro más antiguo; si no queda nadie, la sala se borra.
--   5. El dueño puede cambiar el nombre, sacar miembros o eliminar la sala.
--
-- Notificación: room_invite (preferencia "friends"), con botón "Unirme".
-- Todo es idempotente: se puede volver a ejecutar sin romper nada.

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  owner      uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists rooms_owner_idx on public.rooms (owner);

create table if not exists public.room_members (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'invited' check (status in ('invited', 'joined')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at  timestamptz,
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

-- Fuera de las políticas para no consultar room_members con RLS dentro de RLS.
create or replace function public.is_room_member(p_room uuid, p_user uuid, p_joined_only boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members m
     where m.room_id = p_room and m.user_id = p_user and (not p_joined_only or m.status = 'joined')
  );
$$;

-- Dos personas que están (ya unidas) en una misma sala.
create or replace function public.share_a_room(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members x join room_members y on y.room_id = x.room_id
     where x.user_id = a and y.user_id = b and x.status = 'joined' and y.status = 'joined'
  );
$$;

revoke all on function public.is_room_member(uuid, uuid, boolean) from public, anon;
revoke all on function public.share_a_room(uuid, uuid) from public, anon;
grant execute on function public.is_room_member(uuid, uuid, boolean) to authenticated;
grant execute on function public.share_a_room(uuid, uuid) to authenticated;

-- ─── Políticas ─────────────────────────────────────────────────────────────
drop policy if exists "see my rooms" on public.rooms;
create policy "see my rooms" on public.rooms
  for select to authenticated using (public.is_room_member(id, auth.uid()));

drop policy if exists "create rooms" on public.rooms;
create policy "create rooms" on public.rooms
  for insert to authenticated with check (owner = auth.uid());

drop policy if exists "owner renames room" on public.rooms;
create policy "owner renames room" on public.rooms
  for update to authenticated using (owner = auth.uid()) with check (public.is_room_member(id, auth.uid(), true));

drop policy if exists "owner deletes room" on public.rooms;
create policy "owner deletes room" on public.rooms
  for delete to authenticated using (owner = auth.uid());

drop policy if exists "see room members" on public.room_members;
create policy "see room members" on public.room_members
  for select to authenticated using (public.is_room_member(room_id, auth.uid()));

-- Invita un miembro ya unido, y solo a sus amigos.
drop policy if exists "invite friends to rooms" on public.room_members;
create policy "invite friends to rooms" on public.room_members
  for insert to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_room_member(room_id, auth.uid(), true)
    and public.are_friends(auth.uid(), user_id)
  );

drop policy if exists "accept room invites" on public.room_members;
create policy "accept room invites" on public.room_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Salir o rechazar (la propia fila), o el dueño saca a alguien.
drop policy if exists "leave or remove from rooms" on public.room_members;
create policy "leave or remove from rooms" on public.room_members
  for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from rooms r where r.id = room_id and r.owner = auth.uid()));

-- Los miembros de una sala ven el avance de los demás (solo % y minutos).
drop policy if exists "room mates read progress" on public.day_progress;
create policy "room mates read progress" on public.day_progress
  for select to authenticated using (public.share_a_room(auth.uid(), user_id));

-- ─── Reglas ────────────────────────────────────────────────────────────────
create or replace function public.rooms_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  n int;
begin
  new.name := btrim(new.name);
  if tg_op = 'INSERT' then
    new.created_at := now();
    select count(*) into n from rooms where owner = new.owner;
    if n >= 10 then
      raise exception 'Ya tienes 10 salas. Elimina una antes de crear otra.';
    end if;
    return new;
  end if;
  if new.created_at <> old.created_at then
    raise exception 'La fecha de una sala no se puede cambiar.';
  end if;
  if new.owner <> old.owner then
    if auth.uid() is not null and auth.uid() <> old.owner then
      raise exception 'Solo el dueño puede pasar la sala.';
    end if;
    if not exists (select 1 from room_members m where m.room_id = new.id and m.user_id = new.owner and m.status = 'joined') then
      raise exception 'La sala solo puede pasar a alguien que ya está en ella.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists rooms_guard on public.rooms;
create trigger rooms_guard before insert or update on public.rooms
  for each row execute function public.rooms_guard();

-- El dueño entra a su sala al crearla.
create or replace function public.rooms_owner_joins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into room_members (room_id, user_id, status, invited_by, joined_at)
  values (new.id, new.owner, 'joined', null, now())
  on conflict (room_id, user_id) do update set status = 'joined', joined_at = coalesce(room_members.joined_at, now());
  return new;
end $$;

drop trigger if exists rooms_owner_joins on public.rooms;
create trigger rooms_owner_joins after insert on public.rooms
  for each row execute function public.rooms_owner_joins();

create or replace function public.room_members_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  r rooms;
  n int;
begin
  select * into r from rooms where id = coalesce(new.room_id, old.room_id);
  if tg_op = 'INSERT' then
    new.created_at := now();
    if r.id is not null and new.user_id = r.owner then
      new.status := 'joined';
      new.joined_at := coalesce(new.joined_at, now());
      return new;
    end if;
    new.status := 'invited';
    new.joined_at := null;
    select count(*) into n from room_members where room_id = new.room_id;
    if n >= 20 then
      raise exception 'La sala ya tiene 20 personas.';
    end if;
    return new;
  end if;
  -- UPDATE
  if new.room_id <> old.room_id or new.user_id <> old.user_id or new.invited_by is distinct from old.invited_by or new.created_at <> old.created_at then
    raise exception 'Una invitación a sala no se puede cambiar de dueño ni de sala.';
  end if;
  if new.status <> old.status then
    if not (old.status = 'invited' and new.status = 'joined') then
      raise exception 'Quien ya está en la sala no vuelve a invitado.';
    end if;
    new.joined_at := now();
  else
    new.joined_at := old.joined_at;
  end if;
  return new;
end $$;

drop trigger if exists room_members_guard on public.room_members;
create trigger room_members_guard before insert or update on public.room_members
  for each row execute function public.room_members_guard();

-- Si sale el dueño, la sala pasa al miembro unido más antiguo; si no queda nadie unido, se borra.
create or replace function public.room_members_after_leave()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  heir uuid;
begin
  select * into r from rooms where id = old.room_id;
  if r.id is null or r.owner <> old.user_id then
    return old;
  end if;
  select m.user_id into heir from room_members m
   where m.room_id = old.room_id and m.status = 'joined'
   order by m.joined_at nulls last, m.created_at
   limit 1;
  if heir is null then
    delete from rooms where id = old.room_id;
  else
    update rooms set owner = heir where id = old.room_id;
  end if;
  return old;
end $$;

drop trigger if exists room_members_after_leave on public.room_members;
create trigger room_members_after_leave after delete on public.room_members
  for each row execute function public.room_members_after_leave();

-- Crear desde la app: devuelve el id (un insert con returning chocaría con la
-- política de lectura, porque el dueño entra a su sala un instante después).
create or replace function public.create_room(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión primero.';
  end if;
  insert into rooms (name, owner) values (p_name, auth.uid()) returning id into rid;
  return rid;
end $$;

revoke all on function public.create_room(text) from public, anon;
grant execute on function public.create_room(text) to authenticated;

-- ─── Notificación de invitación ────────────────────────────────────────────
create or replace function public.room_members_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nm text;
begin
  if new.status = 'invited' and new.invited_by is not null then
    select name into nm from rooms where id = new.room_id;
    perform public.push_enqueue('room_invite', new.user_id, new.invited_by,
      jsonb_build_object('room_id', new.room_id, 'name', nm, 'dedupe', new.room_id::text));
  end if;
  return new;
end $$;

drop trigger if exists room_members_push on public.room_members;
create trigger room_members_push after insert on public.room_members
  for each row execute function public.room_members_push();

-- En vivo: la app recarga cuando alguien entra, sale o lo invitan.
do $$
declare
  t text;
begin
  foreach t in array array['rooms', 'room_members'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─── Amigo bot: también entra a salas ──────────────────────────────────────
-- Acepta las invitaciones a salas (además de lo que ya hacía con los hábitos).
create or replace function public.ritmo_bot_habits()
returns void language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  t_local timestamp := now() at time zone 'America/Bogota';
  d date := (now() at time zone 'America/Bogota')::date;
  mins int := extract(hour from t_local)::int * 60 + extract(minute from t_local)::int;
begin
  select id into bot from ritmo_bot limit 1;
  if bot is null then
    return;
  end if;
  update shared_habits
     set status = 'active'
   where partner = bot and status = 'pending' and created_at < now() - interval '20 seconds';
  update room_members
     set status = 'joined'
   where user_id = bot and status = 'invited' and created_at < now() - interval '20 seconds';
  if mins between 420 and 1260 then
    insert into shared_habit_checks (habit_id, user_id, day)
    select h.id, bot, d
      from shared_habits h
     where bot in (h.created_by, h.partner) and h.status = 'active' and h.accepted_at < now() - interval '1 minute'
    on conflict do nothing;
  end if;
end $$;

-- El bot crea una sala y te invita (para probar la invitación y el ranking de sala).
create or replace function public.ritmo_bot_room(p_name text default 'Sala de prueba')
returns text language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  owner_id uuid;
  rid uuid;
  nm text := coalesce(nullif(btrim(p_name), ''), 'Sala de prueba');
begin
  select id, owner into bot, owner_id from ritmo_bot limit 1;
  if bot is null or owner_id is null then
    raise exception 'El bot no existe todavía. Ejecuta primero la acción "preparar".';
  end if;
  if not public.are_friends(bot, owner_id) then
    raise exception 'Amigo Bot y tú no son amigos. Ejecuta "solicitud" y acéptala en la app.';
  end if;
  delete from rooms where owner = bot and name = nm;
  insert into rooms (name, owner) values (nm, bot) returning id into rid;
  insert into room_members (room_id, user_id, invited_by) values (rid, owner_id, bot);
  return format('Sala "%s" creada: debería llegarte "Amigo Bot te invitó a %s".', nm, nm);
end $$;

revoke all on function public.ritmo_bot_habits() from public, anon, authenticated;
revoke all on function public.ritmo_bot_room(text) from public, anon, authenticated;
