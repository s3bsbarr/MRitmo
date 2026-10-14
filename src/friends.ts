/**
 * Friends and the live daily board. Only the day's progress is shared
 * (minutes done / planned, and whether you are in focus right now); task
 * titles never leave your account. Row Level Security enforces it server-side.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { dayKey, Gender, progressOf, shiftDay, Task } from './data';
import { getSession, supabase } from './sync';

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  gender: Gender;
  /** They chose "Ocultar mi avance" (1.9): on boards without %, minutes or focus. */
  hide_progress?: boolean;
};

/** Columns every profile read asks for. */
export const PROFILE_COLUMNS = 'id, username, display_name, gender, hide_progress';

export type BoardRow = {
  profile: Profile;
  me: boolean;
  done: number;
  total: number;
  ratio: number;
  focusUntil: number | null;
  /** Someone else who hides their progress (1.9): shown without numbers, at the bottom. */
  hidden: boolean;
};

export type FriendsState = {
  me: Profile | null;
  friends: Profile[];
  incoming: Profile[];
  outgoing: Profile[];
  progress: Record<string, { done: number; total: number; focusUntil: number | null }>;
  /** This week so far (Monday to today), summed (1.8). */
  week: Record<string, { done: number; total: number }>;
};

/** Board period: today, or this week from Monday (1.8). */
export type Period = 'day' | 'week';

/** Monday of the week that holds `today` (weeks run Monday to Sunday). */
export function weekStartOf(today = dayKey()) {
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return shiftDay(today, -((dow + 6) % 7));
}

/** Your own week, from your days (and today live). */
export function weekOfMine(history: DayProgress[], todayLive: { done: number; total: number }, today = dayKey()) {
  const from = weekStartOf(today);
  let done = Math.round(todayLive.done);
  let total = Math.round(todayLive.total);
  for (const d of history) {
    if (d.day < from || d.day >= today) continue;
    done += d.done;
    total += d.total;
  }
  return { done, total };
}

type Live = { done: number; total: number; focusUntil: number | null };

/**
 * Rank people by the share of planned time they've done (today or this week),
 * then by minutes. Used by the friends board and by every room.
 */
export function rankRows(
  people: Profile[],
  me: Profile,
  mine: { today: Live; week: { done: number; total: number } },
  progress: { today: Record<string, Live>; week: Record<string, { done: number; total: number }> },
  period: Period,
): BoardRow[] {
  const pick = (today: Live | undefined, week: { done: number; total: number } | undefined) => {
    const t = today ?? { done: 0, total: 0, focusUntil: null };
    const v = period === 'day' ? t : (week ?? { done: 0, total: 0 });
    return { done: v.done, total: v.total, focusUntil: t.focusUntil, ratio: v.total ? Math.min(1, v.done / v.total) : 0 };
  };
  const hiddenRow = { done: 0, total: 0, focusUntil: null, ratio: 0, hidden: true };
  const rows: BoardRow[] = [
    { profile: me, me: true, hidden: false, ...pick(mine.today, mine.week) },
    ...people
      .filter((p) => p.id !== me.id)
      .map((p) => (p.hide_progress ? { profile: p, me: false, ...hiddenRow } : { profile: p, me: false, hidden: false, ...pick(progress.today[p.id], progress.week[p.id]) })),
  ];
  return rows.sort((a, b) => Number(a.hidden) - Number(b.hidden) || b.ratio - a.ratio || b.done - a.done || Number(b.me) - Number(a.me));
}

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

function fail(e: { message?: string; code?: string } | null, fallback: string): never {
  if (e?.code === '23505') throw new Error('Ese usuario ya está tomado. Prueba con otro.');
  if (/network|fetch/i.test(e?.message ?? '')) throw new Error('Sin conexión. Revisa tu internet.');
  throw new Error(fallback);
}

async function myId() {
  const s = await getSession();
  return s?.user.id ?? null;
}

export async function getMyProfile(): Promise<Profile | null> {
  const id = await myId();
  if (!id) return null;
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (error) fail(error, 'No se pudo cargar tu perfil.');
  return (data as Profile) ?? null;
}

export async function claimUsername(raw: string, displayName: string, gender: Gender) {
  const id = await myId();
  if (!id) throw new Error('Inicia sesión primero.');
  const username = normalizeUsername(raw);
  if (!USERNAME_RE.test(username)) throw new Error('Usa de 3 a 20 letras minúsculas, números, punto o guion bajo.');
  const { error } = await supabase.from('profiles').insert({ id, username, display_name: displayName.trim(), gender });
  if (error) fail(error, 'No se pudo guardar tu usuario.');
}

/** Keep the public name and character in step with Settings. */
export async function syncProfile(displayName: string, gender: Gender) {
  const id = await myId();
  if (!id) return;
  await supabase.from('profiles').update({ display_name: displayName.trim(), gender }).eq('id', id);
}

export async function sendRequest(raw: string) {
  const id = await myId();
  if (!id) throw new Error('Inicia sesión primero.');
  const username = normalizeUsername(raw);
  const { data: target, error } = await supabase.from('profiles').select('id, username').eq('username', username).maybeSingle();
  if (error) fail(error, 'No se pudo buscar ese usuario.');
  if (!target) throw new Error(`No existe @${username}.`);
  if (target.id === id) throw new Error('Ese eres tú.');
  // You blocked them (1.9): unblock first, or the database silently drops the request.
  const { data: blocked } = await supabase.from('blocks').select('blocked').eq('blocker', id).eq('blocked', target.id).maybeSingle();
  if (blocked) throw new Error(`Bloqueaste a @${username}. Desbloquéalo en Configuración → Privacidad para agregarlo.`);

  // If they already asked you, adding them back accepts it.
  const { data: reverse } = await supabase
    .from('friendships')
    .select('status')
    .eq('requester', target.id)
    .eq('addressee', id)
    .maybeSingle();
  if (reverse) {
    await accept(target.id);
    return 'accepted' as const;
  }
  const { error: insErr } = await supabase.from('friendships').insert({ requester: id, addressee: target.id });
  if (insErr?.code === '23505') throw new Error(`Ya le enviaste una solicitud a @${username}.`);
  if (insErr) fail(insErr, 'No se pudo enviar la solicitud.');
  return 'sent' as const;
}

export async function accept(requesterId: string) {
  const id = await myId();
  if (!id) return;
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', requesterId).eq('addressee', id);
  if (error) fail(error, 'No se pudo aceptar.');
}

/** Decline a request, cancel one you sent, or remove a friend. */
export async function removeFriend(otherId: string) {
  const id = await myId();
  if (!id) return;
  await supabase.from('friendships').delete().eq('requester', id).eq('addressee', otherId);
  await supabase.from('friendships').delete().eq('requester', otherId).eq('addressee', id);
}

export async function loadFriends(): Promise<FriendsState> {
  const empty: FriendsState = { me: null, friends: [], incoming: [], outgoing: [], progress: {}, week: {} };
  const id = await myId();
  if (!id) return empty;
  const me = await getMyProfile();
  if (!me) return empty;

  const { data: rows, error } = await supabase.from('friendships').select('requester, addressee, status');
  if (error) fail(error, 'No se pudo cargar tus amigos.');
  const other = (r: { requester: string; addressee: string }) => (r.requester === id ? r.addressee : r.requester);
  const friendIds = (rows ?? []).filter((r) => r.status === 'accepted').map(other);
  const incomingIds = (rows ?? []).filter((r) => r.status === 'pending' && r.addressee === id).map((r) => r.requester);
  const outgoingIds = (rows ?? []).filter((r) => r.status === 'pending' && r.requester === id).map((r) => r.addressee);

  const ids = [...new Set([...friendIds, ...incomingIds, ...outgoingIds])];
  const profiles: Record<string, Profile> = {};
  if (ids.length) {
    const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', ids);
    for (const p of (data ?? []) as Profile[]) profiles[p.id] = p;
  }

  const progress: FriendsState['progress'] = {};
  const week: FriendsState['week'] = {};
  if (friendIds.length) {
    const today = dayKey();
    const { data } = await supabase
      .from('day_progress')
      .select('user_id, day, done_minutes, total_minutes, focus_until')
      .gte('day', weekStartOf(today))
      .lte('day', today)
      .in('user_id', friendIds);
    for (const r of data ?? []) {
      const w = (week[r.user_id] ??= { done: 0, total: 0 });
      w.done += r.done_minutes;
      w.total += r.total_minutes;
      if (r.day !== today) continue;
      progress[r.user_id] = {
        done: r.done_minutes,
        total: r.total_minutes,
        focusUntil: r.focus_until ? new Date(r.focus_until).getTime() : null,
      };
    }
  }

  const pick = (list: string[]) => list.map((x) => profiles[x]).filter(Boolean);
  return { me, friends: pick(friendIds), incoming: pick(incomingIds), outgoing: pick(outgoingIds), progress, week };
}

/** The friends board: you plus friends, highest share first (today by default, or this week). */
export function boardOf(
  st: FriendsState,
  mine: { done: number; total: number; focusUntil: number | null },
  period: Period = 'day',
  myWeek: { done: number; total: number } = mine,
): BoardRow[] {
  if (!st.me) return [];
  return rankRows(st.friends, st.me, { today: mine, week: myWeek }, { today: st.progress, week: st.week }, period);
}

export type DayProgress = { day: string; done: number; total: number };

/** How far back friends can see your days (enough for streaks and the week). */
export const HISTORY_DAYS = 60;

/** Your last days as friends see them: minutes only, from your own tasks. */
export function historyOf(tasks: Task[], days = HISTORY_DAYS, today = dayKey()): DayProgress[] {
  const from = shiftDay(today, -(days - 1));
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.day < from || t.day > today) continue;
    const list = byDay.get(t.day);
    if (list) list.push(t);
    else byDay.set(t.day, [t]);
  }
  return [...byDay.entries()].map(([day, list]) => {
    const p = progressOf(list);
    return { day, done: Math.round(p.done), total: Math.round(p.total) };
  });
}

/** Days in a row at 100 %. Today counts once it is complete; until then it does not break the streak. */
export function streakOfDays(days: DayProgress[], today = dayKey()) {
  const full = new Set(days.filter((d) => d.total > 0 && d.done >= d.total).map((d) => d.day));
  let day = full.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (full.has(day)) {
    n++;
    day = shiftDay(day, -1);
  }
  return n;
}

/** The last seven days, oldest first; null where nothing was planned. */
export function weekOfDays(days: DayProgress[], today = dayKey()) {
  const map = new Map(days.map((d) => [d.day, d]));
  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftDay(today, i - 6);
    const d = map.get(key);
    return { day: key, ratio: d && d.total > 0 ? Math.min(1, d.done / d.total) : null };
  });
}

/** A friend's recent days (Row Level Security only returns them to friends). */
export async function loadDays(userId: string, days = HISTORY_DAYS): Promise<DayProgress[]> {
  const { data, error } = await supabase
    .from('day_progress')
    .select('day, done_minutes, total_minutes')
    .eq('user_id', userId)
    .gte('day', shiftDay(dayKey(), -(days - 1)))
    .order('day', { ascending: true });
  if (error) fail(error, 'No se pudo cargar su historial.');
  return (data ?? []).map((r) => ({ day: r.day, done: r.done_minutes, total: r.total_minutes }));
}

/** What the server has from you, so unchanged days are never sent again. */
const published = new Map<string, string>();
let publishedFor = '';

/**
 * Share today's progress and your recent days. Cheap to call often: only days
 * that changed are written, in one request. Titles never leave the phone.
 */
export async function publishProgress(today: { done: number; total: number; focusUntil: number | null }, history: DayProgress[] = []) {
  const id = await myId();
  if (!id) return;
  if (publishedFor !== id) {
    published.clear();
    publishedFor = id;
  }
  const todayKey = dayKey();
  const rows = new Map<string, { done: number; total: number; focus: string | null }>();
  for (const d of history) if (d.day !== todayKey) rows.set(d.day, { done: d.done, total: d.total, focus: null });
  // A day that had a plan and now has none goes back to 0 so it stops counting.
  for (const day of published.keys()) if (!rows.has(day) && day !== todayKey && day >= shiftDay(todayKey, -(HISTORY_DAYS - 1))) rows.set(day, { done: 0, total: 0, focus: null });
  rows.set(todayKey, {
    done: Math.round(today.done),
    total: Math.round(today.total),
    focus: today.focusUntil ? new Date(today.focusUntil).toISOString() : null,
  });

  const now = new Date().toISOString();
  const changed = [...rows.entries()]
    .map(([day, r]) => ({ day, r, key: `${r.done}|${r.total}|${r.focus ?? ''}` }))
    .filter(({ day, r, key }) => published.get(day) !== key && !(r.total === 0 && r.done === 0 && !published.has(day) && day !== todayKey));
  if (changed.length === 0) return;

  const { error } = await supabase.from('day_progress').upsert(
    changed.map(({ day, r }) => ({
      user_id: id,
      day,
      done_minutes: Math.max(0, r.done),
      total_minutes: Math.max(0, r.total),
      focus_until: r.focus,
      updated_at: now,
    })),
  );
  // Fails until a username exists (rows belong to a profile); the next call retries.
  if (!error) for (const { day, key } of changed) published.set(day, key);
}

/* ─── Offline (1.9) ─────────────────────────────────────────────────────────
 * The last board that loaded, kept on the phone: without a connection the
 * Amigos tab shows it (marked as not live) instead of an empty screen. */

const CACHE_KEY = 'ritmo.friends.v1';

export type FriendsCache<R = unknown, P = unknown> = { userId: string; at: number; day: string; st: FriendsState; rooms: R; roomProgress: P };

export async function saveFriendsCache<R, P>(st: FriendsState, rooms: R, roomProgress: P) {
  const id = await myId();
  if (!id || !st.me) return;
  const c: FriendsCache<R, P> = { userId: id, at: Date.now(), day: dayKey(), st, rooms, roomProgress };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(c)).catch(() => {});
}

export async function loadFriendsCache<R, P>(): Promise<FriendsCache<R, P> | null> {
  try {
    const id = await myId();
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const c = raw ? (JSON.parse(raw) as FriendsCache<R, P>) : null;
    if (!c || c.userId !== id) return null;
    // Yesterday's numbers aren't today's: keep the people, drop the day's progress.
    if (c.day !== dayKey()) c.st = { ...c.st, progress: {} };
    return c;
  } catch {
    return null;
  }
}

export async function clearFriendsCache() {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

export const isOfflineError = (message: string | null | undefined) => Boolean(message && /sin conexión|network|fetch/i.test(message));

/** Live board: any friend's progress change or a new request triggers a reload. */
export function subscribeFriends(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const ping = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 400);
  };
  const channel: RealtimeChannel = supabase
    .channel('ritmo-friends')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'day_progress' }, ping)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, ping)
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
