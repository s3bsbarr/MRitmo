-- Ritmo 1.6 · Notificaciones push desde el servidor y cierre de amistades.
--
-- Cómo viaja una notificación:
--   1. Algo pasa en la base (p. ej. una solicitud de amistad).
--   2. Un trigger escribe un evento en `push_events` (cola con historial).
--   3. Otro trigger llama a la Edge Function `push` con el id del evento (pg_net).
--   4. La función reclama el evento, arma el texto, lo envía a Expo Push y lo cierra.
-- Para la 1.7 (hábitos compartidos) basta con insertar eventos de otros tipos.
-- Todo es idempotente: se puede volver a ejecutar sin romper nada.

-- ─── Limpieza: hábitos viajan dentro de user_state ─────────────────────────
drop table if exists public.habit_checks;
drop table if exists public.habits;

-- ─── Seguridad de amistades ────────────────────────────────────────────────
-- La política de aceptar permitía cambiar el `requester` de una fila propia y
-- fabricar una amistad aceptada con cualquiera. Ya no: las partes son fijas y
-- una amistad aceptada no vuelve a pendiente.
create or replace function public.friendships_guard()
returns trigger language plpgsql as $$
begin
  if new.requester <> old.requester or new.addressee <> old.addressee then
    raise exception 'Las partes de una amistad no se pueden cambiar.';
  end if;
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'Una amistad aceptada no vuelve a pendiente.';
  end if;
  return new;
end $$;

drop trigger if exists friendships_guard on public.friendships;
create trigger friendships_guard before update on public.friendships
  for each row execute function public.friendships_guard();

-- ─── Tokens de push (uno por teléfono) ─────────────────────────────────────
create table if not exists public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  platform   text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "own tokens select" on public.push_tokens;
create policy "own tokens select" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own tokens delete" on public.push_tokens;
create policy "own tokens delete" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

-- Registrar pasa por aquí: si el teléfono cambió de cuenta, el token se muda.
create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión primero.';
  end if;
  if p_token !~ '^(Exponent|Expo)PushToken\[.+\]$' then
    raise exception 'Token de push no válido.';
  end if;
  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, 'android'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ─── Preferencias (las que el servidor necesita saber) ─────────────────────
-- prefs: {"friends": false} apaga solicitudes y aceptaciones. Clave ausente = encendida.
create table if not exists public.notification_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists "own notification settings" on public.notification_settings;
create policy "own notification settings" on public.notification_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Cola de eventos ───────────────────────────────────────────────────────
create table if not exists public.push_events (
  id         bigint generated always as identity primary key,
  kind       text not null,                 -- friend_request, friend_accepted… (1.7: habit_invite, habit_nudge)
  recipient  uuid not null references auth.users (id) on delete cascade,
  actor      uuid references auth.users (id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  attempts   smallint not null default 0,
  sent_at    timestamptz,
  result     text
);
create index if not exists push_events_pending_idx on public.push_events (created_at) where sent_at is null;
create index if not exists push_events_throttle_idx on public.push_events (kind, recipient, actor, created_at desc);

-- Sin políticas: solo el servidor la lee y la escribe.
alter table public.push_events enable row level security;

-- Dirección pública de las Edge Functions de este proyecto.
create or replace function public.ritmo_function_url(fn text)
returns text language sql immutable as $$
  select 'https://qehkinjwkpfmmmyxqjxm.supabase.co/functions/v1/' || fn
$$;

create extension if not exists pg_net with schema extensions;

-- Pide a la Edge Function que envíe un evento. Nunca bloquea a quien lo causó.
create or replace function public.push_kick(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := public.ritmo_function_url('push'),
    body := jsonb_build_object('id', p_id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 15000
  );
exception when others then
  null; -- el barrido de cada minuto lo reintenta
end $$;

revoke all on function public.push_kick(bigint) from public, anon, authenticated;

create or replace function public.push_events_dispatch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.push_kick(new.id);
  return new;
end $$;

drop trigger if exists push_events_dispatch on public.push_events;
create trigger push_events_dispatch after insert on public.push_events
  for each row execute function public.push_events_dispatch();

-- Cuenta de prueba (ver la migración del bot). Se crea aquí porque el freno anti-spam la exime.
create table if not exists public.ritmo_bot (
  id         uuid primary key references public.profiles (id) on delete cascade,
  owner      uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.ritmo_bot enable row level security;

-- Encolar un evento con freno anti-spam: el mismo tipo, de la misma persona a la
-- misma persona, como mucho una vez por `p_every`. El amigo bot no tiene freno.
create or replace function public.push_enqueue(
  p_kind text, p_recipient uuid, p_actor uuid, p_payload jsonb default '{}'::jsonb, p_every interval default interval '1 hour'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null or p_recipient = p_actor then
    return;
  end if;
  if not exists (select 1 from ritmo_bot b where b.id = p_actor) and exists (
    select 1 from push_events
    where kind = p_kind and recipient = p_recipient and actor is not distinct from p_actor
      and created_at > now() - p_every
  ) then
    return;
  end if;
  insert into push_events (kind, recipient, actor, payload) values (p_kind, p_recipient, p_actor, coalesce(p_payload, '{}'::jsonb));
end $$;

revoke all on function public.push_enqueue(text, uuid, uuid, jsonb, interval) from public, anon, authenticated;

-- La Edge Function reclama un evento: devuelve lo necesario para enviarlo o nada
-- si ya se envió, si otro intento lo tiene, o si se agotaron los intentos.
create or replace function public.push_claim(p_id bigint)
returns table (
  kind text,
  payload jsonb,
  actor_id uuid,
  actor_name text,
  actor_username text,
  tokens text[],
  prefs jsonb
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  ev push_events;
begin
  update push_events e
     set claimed_at = now(), attempts = e.attempts + 1
   where e.id = p_id
     and e.sent_at is null
     and e.attempts < 3
     and (e.claimed_at is null or e.claimed_at < now() - interval '2 minutes')
  returning e.* into ev;
  if ev.id is null then
    return;
  end if;
  return query
    select ev.kind,
           ev.payload,
           ev.actor,
           coalesce(nullif(p.display_name, ''), '@' || p.username, 'Alguien'),
           p.username,
           coalesce((select array_agg(t.token) from push_tokens t where t.user_id = ev.recipient), '{}'),
           coalesce((select s.prefs from notification_settings s where s.user_id = ev.recipient), '{}'::jsonb)
      from (select 1) one
      left join profiles p on p.id = ev.actor;
end $$;

create or replace function public.push_finish(p_id bigint, p_result text, p_dead_tokens text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  update push_events set sent_at = now(), result = left(p_result, 500) where id = p_id;
  if coalesce(array_length(p_dead_tokens, 1), 0) > 0 then
    delete from push_tokens where token = any (p_dead_tokens);
  end if;
end $$;

revoke all on function public.push_claim(bigint) from public, anon, authenticated;
revoke all on function public.push_finish(bigint, text, text[]) from public, anon, authenticated;
grant execute on function public.push_claim(bigint) to service_role;
grant execute on function public.push_finish(bigint, text, text[]) to service_role;

-- ─── Amistades → eventos ───────────────────────────────────────────────────
create or replace function public.friendships_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.push_enqueue('friend_request', new.addressee, new.requester);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.push_enqueue('friend_accepted', new.requester, new.addressee);
  end if;
  return new;
end $$;

drop trigger if exists friendships_push on public.friendships;
create trigger friendships_push after insert or update of status on public.friendships
  for each row execute function public.friendships_push();
