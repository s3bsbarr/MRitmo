-- MRitmo 1.9 · Privacidad (ocultar mi avance, bloquear) y eliminar la cuenta.
--
-- Ocultar mi avance: profiles.hide_progress. Tus amigos y tus salas siguen
-- viéndote en el ranking, pero sin % ni minutos ni "en foco": la base deja de
-- entregarles tus filas de day_progress. Tú sigues publicando tu avance, así
-- que al volver a mostrarlo aparece tu historial completo.
--
-- Bloquear: tabla blocks (solo la ve quien bloquea). Al bloquear:
--   · se borra la amistad o la solicitud entre los dos (y con ella sus hábitos juntos),
--   · se borran las invitaciones a salas pendientes entre los dos y los avisos sin enviar,
--   · ninguno ve el avance del otro, ni siquiera en una sala que compartan,
--   · quien fue bloqueado deja de encontrar el perfil de quien lo bloqueó,
--   · no se pueden enviar solicitudes ni avisos entre ellos.
-- Quien es bloqueado no recibe ningún aviso de que lo bloquearon.
--
-- Eliminar la cuenta: la Edge Function delete-account borra el usuario de
-- auth.users y todo cae en cascada. Antes, este trigger pasa cada sala del
-- dueño al miembro unido más antiguo (rooms.owner es on delete cascade: sin
-- esto, la sala desaparecería para todos).
--
-- Todo es idempotente: se puede volver a ejecutar sin romper nada.

-- ─── Ocultar mi avance ─────────────────────────────────────────────────────
alter table public.profiles add column if not exists hide_progress boolean not null default false;

create or replace function public.progress_hidden(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.hide_progress from profiles p where p.id = p_user), false);
$$;

revoke all on function public.progress_hidden(uuid) from public, anon;
grant execute on function public.progress_hidden(uuid) to authenticated;

-- ─── Bloqueos ──────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker    uuid not null references public.profiles (id) on delete cascade,
  blocked    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked);

alter table public.blocks enable row level security;

drop policy if exists "see my blocks" on public.blocks;
create policy "see my blocks" on public.blocks
  for select to authenticated using (blocker = auth.uid());

drop policy if exists "block people" on public.blocks;
create policy "block people" on public.blocks
  for insert to authenticated with check (blocker = auth.uid());

drop policy if exists "unblock people" on public.blocks;
create policy "unblock people" on public.blocks
  for delete to authenticated using (blocker = auth.uid());

-- Hay un bloqueo entre los dos, en cualquier sentido.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and exists (
    select 1 from blocks
     where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

-- ¿Puede `viewer` ver el perfil de `owner`? No, si owner lo bloqueó (salvo que
-- viewer también haya bloqueado a owner: así su lista de bloqueados tiene nombres).
create or replace function public.profile_visible(p_owner uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from blocks where blocker = p_owner and blocked = p_viewer)
      or exists (select 1 from blocks where blocker = p_viewer and blocked = p_owner);
$$;

revoke all on function public.is_blocked(uuid, uuid) from public, anon;
revoke all on function public.profile_visible(uuid, uuid) from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;
grant execute on function public.profile_visible(uuid, uuid) to authenticated;

-- Los amigos y los compañeros de sala dejan de serlo, para todo efecto, si hay un bloqueo.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  ) and not public.is_blocked(a, b);
$$;

create or replace function public.share_a_room(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members x join room_members y on y.room_id = x.room_id
     where x.user_id = a and y.user_id = b and x.status = 'joined' and y.status = 'joined'
  ) and not public.is_blocked(a, b);
$$;

-- Perfiles: quien te bloqueó desaparece de tus búsquedas, salas y listas.
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (public.profile_visible(id, auth.uid()));

-- Avance: amigos y salas, salvo que la persona lo haya ocultado.
drop policy if exists "friends read progress" on public.day_progress;
create policy "friends read progress" on public.day_progress
  for select to authenticated using (public.are_friends(auth.uid(), user_id) and not public.progress_hidden(user_id));

drop policy if exists "room mates read progress" on public.day_progress;
create policy "room mates read progress" on public.day_progress
  for select to authenticated using (public.share_a_room(auth.uid(), user_id) and not public.progress_hidden(user_id));

-- Al bloquear: fuera la amistad o la solicitud (sus hábitos juntos caen con el
-- trigger friendships_cleanup), las invitaciones a salas entre ellos y los avisos sin enviar.
create or replace function public.blocks_apply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from friendships
   where (requester = new.blocker and addressee = new.blocked)
      or (requester = new.blocked and addressee = new.blocker);
  delete from room_members m
   where m.status = 'invited'
     and ((m.user_id = new.blocked and m.invited_by = new.blocker)
       or (m.user_id = new.blocker and m.invited_by = new.blocked));
  delete from push_events e
   where e.sent_at is null
     and ((e.recipient = new.blocker and e.actor = new.blocked)
       or (e.recipient = new.blocked and e.actor = new.blocker));
  return new;
end $$;

drop trigger if exists blocks_apply on public.blocks;
create trigger blocks_apply after insert on public.blocks
  for each row execute function public.blocks_apply();

-- Una solicitud entre personas bloqueadas no se guarda (y no se avisa a nadie).
create or replace function public.friendships_block_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked(new.requester, new.addressee) then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists friendships_block_guard on public.friendships;
create trigger friendships_block_guard before insert on public.friendships
  for each row execute function public.friendships_block_guard();

-- Freno anti-spam de 1.7 + nada de avisos entre personas bloqueadas.
create or replace function public.push_enqueue(
  p_kind text, p_recipient uuid, p_actor uuid, p_payload jsonb default '{}'::jsonb, p_every interval default interval '1 hour'
) returns void language plpgsql security definer set search_path = public as $$
declare
  k text := p_payload ->> 'dedupe';
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;
  if public.is_blocked(p_recipient, p_actor) then
    return;
  end if;
  if not exists (select 1 from ritmo_bot b where b.id = p_actor) and exists (
    select 1 from push_events
    where kind = p_kind and recipient = p_recipient and actor is not distinct from p_actor
      and created_at > now() - p_every
      and (k is null or payload ->> 'dedupe' = k)
  ) then
    return;
  end if;
  insert into push_events (kind, recipient, actor, payload) values (p_kind, p_recipient, p_actor, coalesce(p_payload, '{}'::jsonb));
end $$;

revoke all on function public.push_enqueue(text, uuid, uuid, jsonb, interval) from public, anon, authenticated;

-- ─── Eliminar la cuenta: quien invitó puede desaparecer ────────────────────
-- room_members.invited_by es "on delete set null", pero el guardia de la 1.8
-- rechazaba cualquier cambio de invited_by, así que borrar la cuenta de alguien
-- que invitó gente a una sala fallaba. Ahora solo puede pasar a null.
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
  if new.room_id <> old.room_id or new.user_id <> old.user_id or new.created_at <> old.created_at
     or (new.invited_by is distinct from old.invited_by and new.invited_by is not null) then
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

-- ─── Eliminar la cuenta: las salas no se van con el dueño ──────────────────
-- Corre antes de borrar el perfil (al eliminar la cuenta, auth.users → profiles
-- en cascada). Cada sala del dueño pasa al miembro unido más antiguo; si no
-- queda nadie más, la sala se borra.
create or replace function public.profiles_hand_over_rooms()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  heir uuid;
begin
  for r in select id from rooms where owner = old.id loop
    heir := null;
    select m.user_id into heir from room_members m
     where m.room_id = r.id and m.status = 'joined' and m.user_id <> old.id
     order by m.joined_at nulls last, m.created_at
     limit 1;
    if heir is null then
      delete from rooms where id = r.id;
    else
      update rooms set owner = heir where id = r.id;
    end if;
  end loop;
  return old;
end $$;

drop trigger if exists profiles_hand_over_rooms on public.profiles;
create trigger profiles_hand_over_rooms before delete on public.profiles
  for each row execute function public.profiles_hand_over_rooms();

-- ─── Amigo bot: ocultar su avance y bloquearte (para probar) ───────────────
create or replace function public.ritmo_bot_hide()
returns text language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  hidden boolean;
begin
  select id into bot from ritmo_bot limit 1;
  if bot is null then
    raise exception 'El bot no existe todavía. Ejecuta primero la acción "preparar".';
  end if;
  update profiles set hide_progress = not hide_progress where id = bot returning hide_progress into hidden;
  return case when hidden then 'Amigo Bot ocultó su avance: en tu ranking debe decir "Avance oculto".'
              else 'Amigo Bot volvió a mostrar su avance.' end;
end $$;

create or replace function public.ritmo_bot_block()
returns text language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  owner_id uuid;
begin
  select id, owner into bot, owner_id from ritmo_bot limit 1;
  if bot is null or owner_id is null then
    raise exception 'El bot no existe todavía. Ejecuta primero la acción "preparar".';
  end if;
  if exists (select 1 from blocks where blocker = bot and blocked = owner_id) then
    delete from blocks where blocker = bot and blocked = owner_id;
    return 'Amigo Bot te desbloqueó. Ya puedes encontrarla otra vez; usa "solicitud" para volver a ser amigos.';
  end if;
  insert into blocks (blocker, blocked) values (bot, owner_id) on conflict do nothing;
  return 'Amigo Bot te bloqueó: debe desaparecer de tu ranking, tus salas y la búsqueda de @amigobot.';
end $$;

revoke all on function public.ritmo_bot_hide() from public, anon, authenticated;
revoke all on function public.ritmo_bot_block() from public, anon, authenticated;
