/**
 * Server push: friends (1.6) and shared habits (1.7). This phone's Expo push
 * token is stored under your account; the server sends through Expo when
 * something happens (a request, an acceptance…) even if MRitmo is closed.
 *
 * Needs, at build time: google-services.json (Firebase) and the Expo project
 * id (extra.eas.projectId). Without them the app works as before and Settings
 * says what is missing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSession, supabase } from './sync';

const KEY = 'ritmo.push.v1';
const REFRESH_MS = 24 * 60 * 60 * 1000;

export type PushStatus =
  | { state: 'ready' }
  | { state: 'checking' }
  | { state: 'signed-out' }
  | { state: 'no-permission' }
  | { state: 'not-configured' }
  | { state: 'error'; detail: string };

type Cached = { token: string; userId: string; at: number };

export function projectId(): string | null {
  const id =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return typeof id === 'string' && id.length > 10 ? id : null;
}

async function readCache(): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

/** Register this phone for server push. Cheap to call often: it skips work done in the last day. */
export async function registerPush(force = false): Promise<PushStatus> {
  if (Platform.OS === 'web') return { state: 'not-configured' };
  const session = await getSession();
  if (!session) return { state: 'signed-out' };
  const pid = projectId();
  if (!pid) return { state: 'not-configured' };
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return { state: 'no-permission' };

    const cached = await readCache();
    if (!force && cached && cached.userId === session.user.id && Date.now() - cached.at < REFRESH_MS) {
      return { state: 'ready' };
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) throw error;
    await AsyncStorage.setItem(KEY, JSON.stringify({ token, userId: session.user.id, at: Date.now() } satisfies Cached));
    return { state: 'ready' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    if (/FirebaseApp|google-services|FCM|firebase/i.test(msg)) return { state: 'not-configured' };
    if (/network|fetch|timeout/i.test(msg)) return { state: 'error', detail: 'Sin conexión. Se intenta otra vez al volver a la app.' };
    return { state: 'error', detail: msg.slice(0, 140) };
  }
}

/** Before signing out: this phone stops receiving that account's notifications. */
export async function unregisterPush() {
  const cached = await readCache();
  await AsyncStorage.removeItem(KEY).catch(() => {});
  if (!cached) return;
  await supabase.from('push_tokens').delete().eq('token', cached.token);
}

/** Tell the server which kinds you want. Keys: friends (1.6), habits (1.7). */
export async function savePushPrefs(prefs: { friends: boolean; habits: boolean }) {
  const session = await getSession();
  if (!session) return;
  await supabase
    .from('notification_settings')
    .upsert({ user_id: session.user.id, prefs, updated_at: new Date().toISOString() });
}

export function pushStatusLabel(s: PushStatus, kind: 'friends' | 'habits' = 'friends'): string {
  switch (s.state) {
    case 'ready':
      return kind === 'habits' ? 'Invitaciones y "ya marcó, faltas tú", con la app cerrada' : 'Solicitudes y quién te acepta, con la app cerrada';
    case 'checking':
      return 'Conectando este teléfono…';
    case 'signed-out':
      return 'Necesitas una cuenta';
    case 'no-permission':
      return 'Activa las notificaciones arriba';
    case 'not-configured':
      return 'Falta configurar el servidor de notificaciones';
    case 'error':
      return s.detail;
  }
}
