/**
 * MRitmo · delete-account (1.9)
 *
 * Deletes the signed-in person's account and everything tied to it. Called
 * from Configuración → Eliminar cuenta with the person's own session token.
 *
 * Deployed without the gateway's JWT check (like every MRitmo function): the
 * token is verified here with the Auth server, so only the owner of a session
 * can delete that session's account, and nobody can name another account.
 *
 * What goes: the auth user, and by cascade the backup (user_state), profile,
 * day progress, friendships and requests, shared habits and their marks, room
 * memberships, blocks, push tokens, notification settings and queued pushes.
 * Rooms the person owned pass to their oldest member first (trigger
 * profiles_hand_over_rooms, migration 1.9); a room left empty is deleted.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

function serviceKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (typeof keys.default === 'string' && keys.default) return keys.default as string;
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ ok: false, error: 'Inicia sesión primero.' }, 401);

  let confirm = '';
  try {
    confirm = String((await req.json())?.confirm ?? '');
  } catch {
    // empty body
  }
  // The app sends the word the person typed; a stray call can't delete anything.
  if (confirm !== 'ELIMINAR') return json({ ok: false, error: 'Falta la confirmación.' }, 400);

  const { data, error } = await admin.auth.getUser(jwt);
  const user = data?.user;
  if (error || !user) return json({ ok: false, error: 'Tu sesión venció. Inicia sesión otra vez y vuelve a intentarlo.' }, 401);

  // The bot account is only for tests; it is removed from the server flow, not from here.
  const { data: bot } = await admin.from('ritmo_bot').select('id').eq('id', user.id).maybeSingle();
  if (bot) return json({ ok: false, error: 'La cuenta de prueba se elimina desde el flujo del bot.' }, 400);

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ ok: false, error: `No se pudo eliminar la cuenta: ${delErr.message}` }, 500);

  return json({ ok: true });
});
