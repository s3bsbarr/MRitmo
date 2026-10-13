/**
 * Account and backup. Everything you have lives in one row of `user_state`,
 * readable only by you. Sync is pull → merge → push, so it is safe to run
 * any time: on login, on returning to the app, and shortly after any change.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { applySyncState, loadMeta, loadSyncState, mergeState, saveMeta, SyncState } from './data';

// Publishable key: designed to ship inside apps. Access is enforced by Row Level Security.
const SUPABASE_URL = 'https://qehkinjwkpfmmmyxqjxm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NydqYFDOgermKtIMkasdAA_5HZvlGSa';

export const AUTH_REDIRECT = 'ritmo://auth';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in front, as Supabase recommends for mobile.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Confirma tu correo con el enlace que te enviamos y vuelve a intentarlo.'],
  [/already registered|already exists/i, 'Ya existe una cuenta con ese correo. Inicia sesión.'],
  [/password should be at least|weak password/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/invalid email|unable to validate email/i, 'Ese correo no parece válido.'],
  [/rate limit|too many/i, 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'],
  [/network|fetch/i, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'],
  [/expired|invalid.*(token|otp|code)|(token|otp|code).*invalid/i, 'Ese código o enlace ya no sirve. Pide uno nuevo.'],
  [/should be different|same password/i, 'Usa una contraseña distinta a la anterior.'],
  [/signups not allowed|user not found|otp/i, 'No hay una cuenta con ese correo. Crea una primero.'],
];

export function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return MESSAGES.find(([re]) => re.test(msg))?.[1] ?? 'Algo salió mal. Inténtalo de nuevo.';
}

export async function getSession(): Promise<Session | null> {
  try {
    return (await supabase.auth.getSession()).data.session;
  } catch {
    return null;
  }
}

/** Returns 'signed-in' when the account is ready, or 'confirm' when an email confirmation is pending. */
export async function signUp(email: string, password: string): Promise<'signed-in' | 'confirm'> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: AUTH_REDIRECT },
  });
  if (error) throw error;
  // With email confirmation on, Supabase hides existing accounts behind an empty identities list.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw new Error('User already registered');
  }
  return data.session ? 'signed-in' : 'confirm';
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Passwordless: a one-tap sign-in link sent to the email of an existing account. */
export async function signInWithLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: AUTH_REDIRECT, shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function resendSignup(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: AUTH_REDIRECT } });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut().catch(() => {});
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: AUTH_REDIRECT });
  if (error) throw error;
}

export type EmailCodeKind = 'signup' | 'link' | 'recovery';

/**
 * The 6-digit code from any account email. Same result as tapping the link,
 * for when the link opens in a browser instead of in Ritmo.
 */
export async function verifyEmailCode(email: string, code: string, kind: EmailCodeKind) {
  const type = kind === 'recovery' ? 'recovery' : kind === 'signup' ? 'signup' : 'email';
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export type AuthUrlResult = { ok: true; recovery: boolean } | { ok: false; message: string } | null;

/**
 * Finish a link from an account email: ritmo://auth#access_token=…&refresh_token=…&type=…
 * `recovery` means "Olvidé mi contraseña": the app then asks for the new one.
 */
export async function handleAuthUrl(url: string): Promise<AuthUrlResult> {
  if (!url.startsWith(AUTH_REDIRECT)) return null;
  const params = new URLSearchParams([url.split('#')[1], url.split('?')[1]?.split('#')[0]].filter(Boolean).join('&'));
  const err = params.get('error_description') || params.get('error');
  if (err) return { ok: false, message: friendlyError(new Error(err.replace(/\+/g, ' '))) };
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return { ok: false, message: friendlyError(error) };
  return { ok: true, recovery: params.get('type') === 'recovery' };
}

let inFlight: Promise<SyncResult> | null = null;

export type SyncResult = { ok: true; state: SyncState; changedLocal: boolean } | { ok: false; reason: 'signed-out' | 'error'; message?: string };

/** Pull the backup, merge with what is on this phone, save both. Serialized. */
export function syncNow(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<SyncResult> => {
    try {
      const session = await getSession();
      if (!session) return { ok: false, reason: 'signed-out' };
      const userId = session.user.id;

      const local = await loadSyncState();
      const { data: row, error } = await supabase.from('user_state').select('data').eq('user_id', userId).maybeSingle();
      if (error) throw error;

      const remote = (row?.data ?? null) as SyncState | null;
      const merged = remote ? mergeState(local, { ...remote, updatedAt: remote.updatedAt ?? 0 }) : local;
      const changedLocal = JSON.stringify([merged.tasks, merged.habits, merged.settings]) !== JSON.stringify([local.tasks, local.habits, local.settings]);

      // If you edited something while we waited on the network, keep your edit
      // and merge again on the next pass instead of overwriting it.
      const metaNow = await loadMeta();
      if (metaNow.updatedAt !== local.updatedAt) {
        scheduleSync(undefined, 1500);
        return { ok: true, state: local, changedLocal: false };
      }

      if (changedLocal) await applySyncState(merged);
      else await saveMeta({ ...metaNow, lastSync: Date.now() });

      const { error: upErr } = await supabase
        .from('user_state')
        .upsert({ user_id: userId, data: merged, updated_at: new Date().toISOString() });
      if (upErr) throw upErr;

      return { ok: true, state: merged, changedLocal };
    } catch (e) {
      return { ok: false, reason: 'error', message: friendlyError(e) };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Back up a few seconds after the last change. */
export function scheduleSync(onDone?: (r: SyncResult) => void, delay = 3000) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    syncNow().then((r) => onDone?.(r));
  }, delay);
}
