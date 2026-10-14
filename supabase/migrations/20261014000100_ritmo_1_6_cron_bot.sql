-- MRitmo 1.6 · Tareas programadas del servidor y "amigo bot".
--
-- 1. Barrido de push: cada minuto reintenta eventos que no se enviaron (por
--    ejemplo, si la Edge Function tardó en despertar).
-- 2. Amigo bot: una cuenta de prueba (@amigobot) cuyo avance se mueve solo
--    durante el día (7:00–21:00, hora de Bogotá), entra en foco los primeros
--    25 minutos de cada hora y acepta sola las solicitudes que le envíes.
--    Se crea una vez con el flujo "Amigo bot" de GitHub Actions.

create extension if not exists pg_cron with schema pg_catalog;

-- ─── Barrido de push ───────────────────────────────────────────────────────
create or replace function public.push_sweep()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select id from push_events
     where sent_at is null
       and attempts < 3
       and created_at > now() - interval '1 hour'
       and created_at < now() - interval '30 seconds'
       and (claimed_at is null or claimed_at < now() - interval '2 minutes')
     order by id
     limit 50
  loop
    perform public.push_kick(r.id);
  end loop;
end $$;

revoke all on function public.push_sweep() from public, anon, authenticated;

-- ─── Amigo bot ─────────────────────────────────────────────────────────────
-- Plan del día, igual para una misma fecha: entre 3 h y 6 h; uno de cada seis
-- días se queda en ~70 % para que la racha sea creíble.
create or replace function public.ritmo_bot_plan(d date, out total int, out goal int)
language sql stable as $$
  select t, case when abs(hashtext('ritmo-bot-r' || d::text)) % 6 = 0 then (t * 7 / 10) / 15 * 15 else t end
    from (select 180 + (abs(hashtext('ritmo-bot-t' || d::text)) % 7) * 30 as t) x
$$;

create or replace function public.ritmo_bot_today()
returns date language sql stable as $$
  select (now() at time zone 'America/Bogota')::date
$$;

-- Avance de hoy según la hora. Nunca retrocede (respeta los empujones manuales).
create or replace function public.ritmo_bot_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  owner_id uuid;
  t_local timestamp := now() at time zone 'America/Bogota';
  d date := (now() at time zone 'America/Bogota')::date;
  mins int := extract(hour from t_local)::int * 60 + extract(minute from t_local)::int;
  p record;
  target int;
  f numeric;
  focus timestamptz := null;
begin
  select b.id, b.owner into bot, owner_id from ritmo_bot b limit 1;
  if bot is null then
    return;
  end if;

  -- Acepta solo las solicitudes que le llegan (con unos segundos de espera, como una persona).
  update friendships
     set status = 'accepted'
   where addressee = bot and status = 'pending' and created_at < now() - interval '20 seconds';

  select * into p from ritmo_bot_plan(d);
  f := greatest(0, least(1, (mins - 420)::numeric / 840));
  target := (floor(p.goal * f / 15) * 15)::int;
  if mins between 420 and 1260 and extract(minute from t_local) < 25 then
    focus := date_trunc('hour', now()) + interval '25 minutes';
  end if;

  insert into day_progress (user_id, day, done_minutes, total_minutes, focus_until, updated_at)
  values (bot, d, target, p.total, focus, now())
  on conflict (user_id, day) do update
     set done_minutes = least(greatest(day_progress.done_minutes, excluded.done_minutes), day_progress.total_minutes),
         focus_until = excluded.focus_until,
         updated_at = now()
   where greatest(day_progress.done_minutes, excluded.done_minutes) <> day_progress.done_minutes
      or day_progress.focus_until is distinct from excluded.focus_until;
end $$;

-- Empujón manual: suma minutos a hoy y lo pone en foco 25 min.
create or replace function public.ritmo_bot_nudge(p_minutes int default 30)
returns text language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  d date := public.ritmo_bot_today();
  p record;
  r record;
begin
  select id into bot from ritmo_bot limit 1;
  if bot is null then
    raise exception 'El bot no existe todavía. Ejecuta primero la acción "preparar".';
  end if;
  perform public.ritmo_bot_tick();
  select * into p from ritmo_bot_plan(d);
  update day_progress
     set done_minutes = least(total_minutes, done_minutes + greatest(0, p_minutes)),
         focus_until = case when done_minutes + p_minutes >= total_minutes then null else now() + interval '25 minutes' end,
         updated_at = now()
   where user_id = bot and day = d
  returning done_minutes, total_minutes into r;
  return format('Amigo Bot va en %s de %s min (%s %%).', r.done_minutes, r.total_minutes, round(100.0 * r.done_minutes / greatest(r.total_minutes, 1)));
end $$;

-- Crea o renueva el perfil del bot, su historial de 7 días y la amistad con su dueño.
create or replace function public.ritmo_bot_setup(p_bot uuid, p_owner_username text)
returns text language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  uname text := lower(regexp_replace(coalesce(p_owner_username, ''), '^@', ''));
  d date := public.ritmo_bot_today();
  p record;
  i int;
  done int;
begin
  select id into owner_id from profiles where username = uname;
  if owner_id is null then
    raise exception 'No existe @%. Elige tu @usuario en la pestaña Amigos de la app y vuelve a intentarlo.', uname;
  end if;

  insert into profiles (id, username, display_name, gender)
  values (p_bot, 'amigobot', 'Amigo Bot', 'f')
  on conflict (id) do update set username = 'amigobot', display_name = 'Amigo Bot';

  delete from ritmo_bot where id <> p_bot;
  insert into ritmo_bot (id, owner) values (p_bot, owner_id)
  on conflict (id) do update set owner = excluded.owner;

  -- Historial: 5 días completos seguidos, uno a medias antes y otro completo.
  for i in 1..7 loop
    select * into p from ritmo_bot_plan(d - i);
    done := case when i = 6 then (p.total * 6 / 10) / 15 * 15 else p.total end;
    insert into day_progress (user_id, day, done_minutes, total_minutes, focus_until, updated_at)
    values (p_bot, d - i, done, p.total, null, now())
    on conflict (user_id, day) do update
       set done_minutes = excluded.done_minutes, total_minutes = excluded.total_minutes, focus_until = null, updated_at = now();
  end loop;

  perform public.ritmo_bot_tick();
  return format('Amigo Bot listo para @%s.', uname);
end $$;

-- El bot te envía una solicitud (borra la amistad anterior para poder probar otra vez).
create or replace function public.ritmo_bot_request()
returns text language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  owner_id uuid;
begin
  select id, owner into bot, owner_id from ritmo_bot limit 1;
  if bot is null or owner_id is null then
    raise exception 'El bot no existe todavía. Ejecuta primero la acción "preparar".';
  end if;
  delete from friendships where (requester = bot and addressee = owner_id) or (requester = owner_id and addressee = bot);
  insert into friendships (requester, addressee, status) values (bot, owner_id, 'pending');
  return 'Solicitud enviada: debería llegarte "Amigo Bot te envió una solicitud".';
end $$;

-- Quita la amistad con el bot (para volver a agregarlo desde la app).
create or replace function public.ritmo_bot_remove()
returns text language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
begin
  select id into bot from ritmo_bot limit 1;
  if bot is null then
    return 'No hay bot.';
  end if;
  delete from friendships where requester = bot or addressee = bot;
  return 'Amistad con @amigobot eliminada. Agrégalo desde la app: te acepta solo en menos de un minuto.';
end $$;

revoke all on function public.ritmo_bot_tick() from public, anon, authenticated;
revoke all on function public.ritmo_bot_nudge(int) from public, anon, authenticated;
revoke all on function public.ritmo_bot_setup(uuid, text) from public, anon, authenticated;
revoke all on function public.ritmo_bot_request() from public, anon, authenticated;
revoke all on function public.ritmo_bot_remove() from public, anon, authenticated;

-- ─── Programación ──────────────────────────────────────────────────────────
select cron.schedule('ritmo-push-sweep', '* * * * *', 'select public.push_sweep()');
select cron.schedule('ritmo-bot', '* * * * *', 'select public.ritmo_bot_tick()');
