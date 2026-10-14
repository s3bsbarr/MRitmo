-- MRitmo 1.7 · Hábitos compartidos con racha, y la bandera del correo propio.
--
-- Un hábito compartido es de dos amigos. Uno invita (pending), el otro acepta
-- (active) y desde ahí aparece en el Hoy de los dos. Cada uno marca su día; la
-- racha compartida solo avanza los días que marcaron ambos (se calcula en la app
-- con las marcas de los dos).
--
-- Vive en la base y no en user_state porque lo escriben dos personas. El título
-- lo ven los dos (lo eligieron juntos); nada de las tareas privadas viaja aquí.
--
-- Notificaciones (cola push_events, preferencia "habits"):
--   habit_invite    X te invitó a un hábito            → a quien recibe
--   habit_accepted  X aceptó «título»                   → a quien invitó
--   habit_nudge     X ya marcó «título», faltas tú      → al otro, una vez por hábito y día
--
-- Todo es idempotente: se puede volver a ejecutar sin romper nada.

-- ─── Freno anti-spam por clave ─────────────────────────────────────────────
-- Igual que en 1.6, más una clave opcional (payload.dedupe): con ella el freno
-- es por tipo + personas + clave. Así dos hábitos distintos con la misma
-- persona no se frenan entre sí, y cada hábito avisa como mucho una vez al día.
create or replace function public.push_enqueue(
  p_kind text, p_recipient uuid, p_actor uuid, p_payload jsonb default '{}'::jsonb, p_every interval default interval '1 hour'
) returns void language plpgsql security definer set search_path = public as $$
declare
  k text := p_payload ->> 'dedupe';
begin
  if p_recipient is null or p_recipient = p_actor then
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

-- ─── Hábitos compartidos ───────────────────────────────────────────────────
create table if not exists public.shared_habits (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 60),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  partner     uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'active')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  check (created_by <> partner)
);
create index if not exists shared_habits_created_by_idx on public.shared_habits (created_by);
create index if not exists shared_habits_partner_idx on public.shared_habits (partner);

alter table public.shared_habits enable row level security;

drop policy if exists "see own shared habits" on public.shared_habits;
create policy "see own shared habits" on public.shared_habits
  for select to authenticated using (auth.uid() in (created_by, partner));

-- Solo se invita a amigos, y la invitación siempre nace pendiente.
drop policy if exists "invite friends to shared habits" on public.shared_habits;
create policy "invite friends to shared habits" on public.shared_habits
  for insert to authenticated
  with check (created_by = auth.uid() and status = 'pending' and public.are_friends(created_by, partner));

drop policy if exists "update own shared habits" on public.shared_habits;
create policy "update own shared habits" on public.shared_habits
  for update to authenticated using (auth.uid() in (created_by, partner)) with check (auth.uid() in (created_by, partner));

-- Cualquiera de los dos lo deja (rechazar, cancelar o salir): se borra para ambos.
drop policy if exists "leave shared habits" on public.shared_habits;
create policy "leave shared habits" on public.shared_habits
  for delete to authenticated using (auth.uid() in (created_by, partner));

-- Reglas que una política no puede expresar.
create or replace function public.shared_habits_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  n int;
begin
  new.title := btrim(new.title);
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.accepted_at := null;
    if auth.uid() is not null then
      new.status := 'pending';
    end if;
    select count(*) into n from shared_habits h
     where (h.created_by = new.created_by and h.partner = new.partner)
        or (h.created_by = new.partner and h.partner = new.created_by);
    if n >= 10 then
      raise exception 'Ya tienen 10 hábitos juntos. Deja uno antes de crear otro.';
    end if;
    return new;
  end if;

  if new.created_by <> old.created_by or new.partner <> old.partner or new.created_at <> old.created_at then
    raise exception 'Las partes de un hábito compartido no se pueden cambiar.';
  end if;
  if new.status <> old.status then
    if not (old.status = 'pending' and new.status = 'active') then
      raise exception 'Un hábito aceptado no vuelve a pendiente.';
    end if;
    if auth.uid() is not null and auth.uid() <> old.partner then
      raise exception 'Solo quien recibe la invitación puede aceptarla.';
    end if;
    new.accepted_at := now();
  else
    new.accepted_at := old.accepted_at;
  end if;
  return new;
end $$;

drop trigger if exists shared_habits_guard on public.shared_habits;
create trigger shared_habits_guard before insert or update on public.shared_habits
  for each row execute function public.shared_habits_guard();

-- ─── Marcas de cada día ────────────────────────────────────────────────────
create table if not exists public.shared_habit_checks (
  habit_id   uuid not null references public.shared_habits (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, user_id, day)
);
create index if not exists shared_habit_checks_habit_day_idx on public.shared_habit_checks (habit_id, day);

alter table public.shared_habit_checks enable row level security;

-- Fuera de las políticas para no consultar shared_habits con RLS dentro de RLS.
create or replace function public.is_shared_member(p_habit uuid, p_user uuid, p_active_only boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from shared_habits h
     where h.id = p_habit and p_user in (h.created_by, h.partner)
       and (not p_active_only or h.status = 'active')
  );
$$;

revoke all on function public.is_shared_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.is_shared_member(uuid, uuid, boolean) to authenticated;

drop policy if exists "see shared checks" on public.shared_habit_checks;
create policy "see shared checks" on public.shared_habit_checks
  for select to authenticated using (public.is_shared_member(habit_id, auth.uid()));

-- Cada uno marca solo lo suyo, en un hábito activo, y solo alrededor de hoy
-- (margen de un día por zonas horarias; no se rellenan rachas hacia atrás).
drop policy if exists "check own shared days" on public.shared_habit_checks;
create policy "check own shared days" on public.shared_habit_checks
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_shared_member(habit_id, auth.uid(), true)
    and day between current_date - 1 and current_date + 1
  );

drop policy if exists "uncheck own shared days" on public.shared_habit_checks;
create policy "uncheck own shared days" on public.shared_habit_checks
  for delete to authenticated
  using (user_id = auth.uid() and day between current_date - 1 and current_date + 1);

-- ─── Si se rompe la amistad, se van los hábitos compartidos ────────────────
create or replace function public.friendships_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from shared_habits
   where (created_by = old.requester and partner = old.addressee)
      or (created_by = old.addressee and partner = old.requester);
  return old;
end $$;

drop trigger if exists friendships_cleanup on public.friendships;
create trigger friendships_cleanup after delete on public.friendships
  for each row execute function public.friendships_cleanup();

-- ─── Hábitos compartidos → notificaciones ──────────────────────────────────
create or replace function public.shared_habits_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.push_enqueue('habit_invite', new.partner, new.created_by,
      jsonb_build_object('habit_id', new.id, 'title', new.title, 'dedupe', new.id::text));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.push_enqueue('habit_accepted', new.created_by, new.partner,
      jsonb_build_object('habit_id', new.id, 'title', new.title, 'dedupe', new.id::text));
  end if;
  return new;
end $$;

drop trigger if exists shared_habits_push on public.shared_habits;
create trigger shared_habits_push after insert or update of status on public.shared_habits
  for each row execute function public.shared_habits_push();

-- "X ya marcó, faltas tú": solo si el otro aún no marcó ese día, una vez por hábito y día.
create or replace function public.shared_checks_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  h shared_habits;
  other uuid;
begin
  select * into h from shared_habits where id = new.habit_id and status = 'active';
  if h.id is null or new.day < current_date - 1 then
    return new;
  end if;
  other := case when h.created_by = new.user_id then h.partner else h.created_by end;
  if exists (select 1 from shared_habit_checks c where c.habit_id = new.habit_id and c.user_id = other and c.day = new.day) then
    return new;
  end if;
  perform public.push_enqueue('habit_nudge', other, new.user_id,
    jsonb_build_object('habit_id', h.id, 'title', h.title, 'day', new.day, 'dedupe', h.id::text || ':' || new.day::text),
    interval '20 hours');
  return new;
end $$;

drop trigger if exists shared_checks_push on public.shared_habit_checks;
create trigger shared_checks_push after insert on public.shared_habit_checks
  for each row execute function public.shared_checks_push();

-- En vivo: la app recarga cuando el otro marca, acepta o deja un hábito.
do $$
declare
  t text;
begin
  foreach t in array array['shared_habits', 'shared_habit_checks'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─── Amigo bot: también hace hábitos ───────────────────────────────────────
-- Acepta las invitaciones de hábitos y marca los suyos durante el día (7:00–21:00
-- Bogotá), así se prueban "aceptó" y "ya marcó, faltas tú" desde un solo teléfono.
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
  if mins between 420 and 1260 then
    insert into shared_habit_checks (habit_id, user_id, day)
    select h.id, bot, d
      from shared_habits h
     where bot in (h.created_by, h.partner) and h.status = 'active' and h.accepted_at < now() - interval '1 minute'
    on conflict do nothing;
  end if;
end $$;

-- El bot te invita a un hábito (para probar la invitación).
create or replace function public.ritmo_bot_invite(p_title text default 'Leer 20 minutos')
returns text language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  owner_id uuid;
begin
  select id, owner into bot, owner_id from ritmo_bot limit 1;
  if bot is null or owner_id is null then
    raise exception 'El bot no existe todavía. Ejecuta primero la acción "preparar".';
  end if;
  if not public.are_friends(bot, owner_id) then
    raise exception 'Amigo Bot y tú no son amigos. Ejecuta "solicitud" y acéptala en la app.';
  end if;
  delete from shared_habits where created_by = bot and partner = owner_id and status = 'pending';
  insert into shared_habits (title, created_by, partner) values (coalesce(nullif(btrim(p_title), ''), 'Leer 20 minutos'), bot, owner_id);
  return 'Invitación enviada: debería llegarte "Amigo Bot te invitó a un hábito".';
end $$;

-- El bot marca hoy todos sus hábitos (si tú no has marcado, te llega "ya marcó, faltas tú").
create or replace function public.ritmo_bot_check()
returns text language plpgsql security definer set search_path = public as $$
declare
  bot uuid;
  n int;
begin
  select id into bot from ritmo_bot limit 1;
  if bot is null then
    raise exception 'El bot no existe todavía. Ejecuta primero la acción "preparar".';
  end if;
  -- Borrar y volver a marcar, para poder repetir la prueba el mismo día.
  delete from shared_habit_checks where user_id = bot and day = public.ritmo_bot_today();
  insert into shared_habit_checks (habit_id, user_id, day)
  select h.id, bot, public.ritmo_bot_today() from shared_habits h where bot in (h.created_by, h.partner) and h.status = 'active';
  get diagnostics n = row_count;
  return case when n = 0 then 'Amigo Bot no tiene hábitos activos contigo. Crea uno desde su hoja o usa "habito".'
              else format('Amigo Bot marcó %s %s hoy.', n, case when n = 1 then 'hábito' else 'hábitos' end) end;
end $$;

revoke all on function public.ritmo_bot_habits() from public, anon, authenticated;
revoke all on function public.ritmo_bot_invite(text) from public, anon, authenticated;
revoke all on function public.ritmo_bot_check() from public, anon, authenticated;

select cron.schedule('ritmo-bot-habits', '* * * * *', 'select public.ritmo_bot_habits()');

-- ─── Banderas que la app lee sin sesión ────────────────────────────────────
-- email_code: true cuando hay correo propio (SMTP) y los correos traen el
-- código de 6 dígitos. La pone el paso "auth" del flujo del servidor.
create table if not exists public.app_flags (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_flags enable row level security;

drop policy if exists "flags are public" on public.app_flags;
create policy "flags are public" on public.app_flags
  for select to anon, authenticated using (true);

insert into public.app_flags (key, value) values ('email_code', 'false'::jsonb) on conflict (key) do nothing;
