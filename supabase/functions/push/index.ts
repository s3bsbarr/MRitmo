/**
 * MRitmo · push
 *
 * Receives {"id": <push_events.id>} from the database (pg_net), claims the
 * event, writes the message in Spanish and sends it through Expo Push.
 * Deployed without JWT verification: the body only carries an id, and the
 * database decides whether that id still needs sending (claim is atomic and
 * an event is sent at most once), so calling it from outside does nothing.
 *
 * Adding a new kind = one entry in MESSAGES (+ its push_enqueue in a trigger).
 * 1.7: habit_invite, habit_accepted, habit_nudge (preference "habits").
 * 1.8: room_invite (preference "friends").
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

type Claim = {
  kind: string;
  payload: Record<string, unknown>;
  actor_id: string | null;
  actor_name: string;
  actor_username: string | null;
  tokens: string[];
  prefs: Record<string, unknown>;
};

type Message = {
  pref: string;
  title: string;
  body: string;
  url: string;
  channelId: string;
  /** Buttons registered in the app (src/effects.ts, CAT). They act with the app closed. */
  categoryId?: string;
};

const quoted = (c: Claim) => {
  const t = typeof c.payload?.title === 'string' ? c.payload.title : '';
  return t ? `«${t}»` : 'su hábito';
};

const MESSAGES: Record<string, (c: Claim) => Message> = {
  friend_request: (c) => ({
    pref: 'friends',
    title: `${c.actor_name} te envió una solicitud`,
    body: 'Acéptala para ver el avance del día del otro.',
    url: 'ritmo://amigos',
    channelId: 'ritmo_friends',
  }),
  friend_accepted: (c) => ({
    pref: 'friends',
    title: `${c.actor_name} aceptó tu solicitud`,
    body: 'Ya pueden ver el avance del día del otro.',
    url: c.actor_id ? `ritmo://amigos/${c.actor_id}` : 'ritmo://amigos',
    channelId: 'ritmo_friends',
  }),
  habit_invite: (c) => ({
    pref: 'habits',
    title: `${c.actor_name} te invitó a un hábito`,
    body: `${quoted(c)}. La racha solo avanza el día que los dos lo marcan.`,
    url: c.actor_id ? `ritmo://amigos/${c.actor_id}` : 'ritmo://amigos',
    channelId: 'ritmo_friends',
    categoryId: 'ritmo_shared_invite',
  }),
  habit_accepted: (c) => ({
    pref: 'habits',
    title: `${c.actor_name} aceptó ${quoted(c)}`,
    body: 'Ya está en el Hoy de los dos. La racha empieza cuando ambos lo marquen.',
    url: 'ritmo://hoy',
    channelId: 'ritmo_friends',
  }),
  room_invite: (c) => ({
    pref: 'friends',
    title: `${c.actor_name} te invitó a ${typeof c.payload?.name === 'string' && c.payload.name ? `«${c.payload.name}»` : 'una sala'}`,
    body: 'Una sala con su propio ranking del día y de la semana. Solo se ve el % y los minutos.',
    url: typeof c.payload?.room_id === 'string' ? `ritmo://salas/${c.payload.room_id}` : 'ritmo://amigos',
    channelId: 'ritmo_friends',
    categoryId: 'ritmo_room_invite',
  }),
  habit_nudge: (c) => ({
    pref: 'habits',
    title: `${c.actor_name} ya marcó ${quoted(c)}`,
    body: 'Faltas tú para que la racha avance hoy.',
    url: 'ritmo://hoy',
    channelId: 'ritmo_friends',
    categoryId: 'ritmo_shared_nudge',
  }),
};

function serviceKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (typeof keys.default === 'string' && keys.default) return keys.default as string;
    // After a key rotation there may be no key named "default": use any secret key.
    const any = Object.values(keys).find((v) => typeof v === 'string' && v);
    if (any) return any as string;
  } catch {
    // fall through to the legacy key
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function finish(id: number, result: string, dead: string[] = []) {
  await admin.rpc('push_finish', { p_id: id, p_result: result, p_dead_tokens: dead });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  let id: number;
  try {
    id = Number((await req.json())?.id);
  } catch {
    return json({ ok: false, error: 'bad body' }, 400);
  }
  if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'bad id' }, 400);

  const { data, error } = await admin.rpc('push_claim', { p_id: id });
  if (error) return json({ ok: false, error: error.message }, 500);
  const claim = (Array.isArray(data) ? data[0] : data) as Claim | undefined;
  if (!claim) return json({ ok: true, skipped: 'already handled' });

  const make = MESSAGES[claim.kind];
  if (!make) {
    await finish(id, `unknown kind ${claim.kind}`);
    return json({ ok: true, skipped: 'unknown kind' });
  }
  const msg = make(claim);
  if (claim.prefs?.[msg.pref] === false) {
    await finish(id, `muted (${msg.pref})`);
    return json({ ok: true, skipped: 'muted' });
  }
  const tokens = (claim.tokens ?? []).filter(Boolean);
  if (tokens.length === 0) {
    await finish(id, 'no devices');
    return json({ ok: true, skipped: 'no devices' });
  }

  const messages = tokens.map((to) => ({
    to,
    title: msg.title,
    body: msg.body,
    data: {
      url: msg.url,
      kind: claim.kind,
      ...(typeof claim.payload?.habit_id === 'string' ? { sharedId: claim.payload.habit_id } : {}),
      ...(typeof claim.payload?.room_id === 'string' ? { roomId: claim.payload.room_id } : {}),
    },
    channelId: msg.channelId,
    ...(msg.categoryId ? { categoryId: msg.categoryId } : {}),
    priority: 'high',
    ttl: 60 * 60 * 24,
  }));

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoToken) headers.Authorization = `Bearer ${expoToken}`;

  let res: Response;
  try {
    res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(messages) });
  } catch (e) {
    // Not finished: the sweep retries it (up to 3 attempts).
    return json({ ok: false, error: `expo unreachable: ${(e as Error).message}` }, 502);
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ ok: false, error: `expo ${res.status}`, detail: out }, 502);
  }

  const tickets: { status: string; message?: string; details?: { error?: string } }[] = out?.data ?? [];
  const dead: string[] = [];
  let ok = 0;
  const problems: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === 'ok') ok++;
    else {
      problems.push(t.details?.error ?? t.message ?? 'error');
      if (t.details?.error === 'DeviceNotRegistered') dead.push(tokens[i]);
    }
  });
  await finish(id, `ok ${ok}/${tokens.length}${problems.length ? ` · ${[...new Set(problems)].join(', ')}` : ''}`, dead);
  return json({ ok: true, sent: ok, of: tokens.length });
});
