/**
 * Shared habits (1.7). A habit two friends keep together: one invites, the
 * other accepts, and from then on it sits in both "Hoy". Each marks their own
 * day; the shared streak only grows on days both marked.
 *
 * Lives in the database (two people write it), not in the user_state backup.
 * A copy is cached on the phone so Hoy, widgets and notifications have it
 * offline and from headless JS; marks made offline wait in a small queue.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { dayKey, Gender, shiftDay } from './data';
import { getSession, supabase } from './sync';

export type SharedFriend = { id: string; username: string; display_name: string; gender: Gender };

export type SharedHabit = {
  id: string;
  title: string;
  status: 'pending' | 'active';
  /** You created it (you invited). */
  mine: boolean;
  friend: SharedFriend;
  createdAt: number;
  /** Days each of you marked, YYYY-MM-DD (recent window). */
  myChecks: string[];
  theirChecks: string[];
};

type PendingMark = { id: string; day: string; checked: boolean };

export type SharedCache = { userId: string | null; habits: SharedHabit[]; queue: PendingMark[]; at: number };

const KEY = 'ritmo.shared.v1';
/** How far back marks are loaded: enough for any streak worth showing. */
const WINDOW_DAYS = 400;

const emptyCache: SharedCache = { userId: null, habits: [], queue: [], at: 0 };

export async function loadSharedCache(): Promise<SharedCache> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const c = raw ? (JSON.parse(raw) as SharedCache) : null;
    return c && Array.isArray(c.habits) ? { ...emptyCache, ...c } : emptyCache;
  } catch {
    return emptyCache;
  }
}

async function saveSharedCache(c: SharedCache) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
}

export async function clearSharedCache() {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

/* ─── Pure helpers ─────────────────────────────────────────────────────── */

/** Days in a row both of you marked. Today counts once both marked; until then it doesn't break the streak. */
export function sharedStreak(h: SharedHabit, today = dayKey()) {
  const theirs = new Set(h.theirChecks);
  const both = new Set(h.myChecks.filter((d) => theirs.has(d)));
  let day = both.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (both.has(day)) {
    n++;
    day = shiftDay(day, -1);
  }
  return n;
}

export const markedBy = (h: SharedHabit, day = dayKey()) => ({ me: h.myChecks.includes(day), them: h.theirChecks.includes(day) });

export const friendName = (f: SharedFriend) => f.display_name || `@${f.username}`;

/** Active habits, for Hoy. */
export const activeShared = (list: SharedHabit[]) => list.filter((h) => h.status === 'active');

/** Apply queued offline marks over what the server said. */
function withQueue(habits: SharedHabit[], queue: PendingMark[]) {
  if (!queue.length) return habits;
  return habits.map((h) => {
    let checks = h.myChecks;
    for (const q of queue) {
      if (q.id !== h.id) continue;
      checks = q.checked ? (checks.includes(q.day) ? checks : [...checks, q.day]) : checks.filter((d) => d !== q.day);
    }
    return checks === h.myChecks ? h : { ...h, myChecks: checks };
  });
}

/* ─── Server ───────────────────────────────────────────────────────────── */

function fail(e: { message?: string } | null, fallback: string): never {
  const m = e?.message ?? '';
  if (/network|fetch/i.test(m)) throw new Error('Sin conexión. Revisa tu internet.');
  // Raised by the database in Spanish (limits and rules): show it as is.
  if (/hábito|invitación/i.test(m)) throw new Error(m);
  throw new Error(fallback);
}

async function myId() {
  return (await getSession())?.user.id ?? null;
}

/** Send marks made offline. Keeps the ones that still fail. */
async function flushQueue(queue: PendingMark[], userId: string): Promise<PendingMark[]> {
  const left: PendingMark[] = [];
  for (const q of queue) {
    const { error } = q.checked
      ? await supabase.from('shared_habit_checks').upsert({ habit_id: q.id, user_id: userId, day: q.day }, { ignoreDuplicates: true })
      : await supabase.from('shared_habit_checks').delete().eq('habit_id', q.id).eq('user_id', userId).eq('day', q.day);
    // A network error waits for later; a refusal (habit gone, day too old) is dropped.
    if (error && /network|fetch/i.test(error.message ?? '')) left.push(q);
  }
  return left;
}

/** Everything you share: invitations both ways and active habits with recent marks. Updates the cache. */
export async function fetchShared(): Promise<SharedCache> {
  const userId = await myId();
  if (!userId) {
    await clearSharedCache();
    return emptyCache;
  }
  const cached = await loadSharedCache();
  const queue = cached.userId === userId && cached.queue.length ? await flushQueue(cached.queue, userId) : [];

  const { data: rows, error } = await supabase
    .from('shared_habits')
    .select('id, title, status, created_by, partner, created_at')
    .order('created_at', { ascending: true });
  if (error) fail(error, 'No se pudieron cargar los hábitos compartidos.');

  const list = rows ?? [];
  const otherIds = [...new Set(list.map((r) => (r.created_by === userId ? r.partner : r.created_by)))];
  const profiles: Record<string, SharedFriend> = {};
  if (otherIds.length) {
    const { data } = await supabase.from('profiles').select('id, username, display_name, gender').in('id', otherIds);
    for (const p of (data ?? []) as SharedFriend[]) profiles[p.id] = p;
  }

  const activeIds = list.filter((r) => r.status === 'active').map((r) => r.id);
  const marks: Record<string, { me: string[]; them: string[] }> = {};
  if (activeIds.length) {
    const { data, error: cErr } = await supabase
      .from('shared_habit_checks')
      .select('habit_id, user_id, day')
      .in('habit_id', activeIds)
      .gte('day', shiftDay(dayKey(), -WINDOW_DAYS));
    if (cErr) fail(cErr, 'No se pudieron cargar las marcas.');
    for (const c of data ?? []) {
      const m = (marks[c.habit_id] ??= { me: [], them: [] });
      (c.user_id === userId ? m.me : m.them).push(c.day);
    }
  }

  const habits: SharedHabit[] = list
    .map((r) => {
      const otherId = r.created_by === userId ? r.partner : r.created_by;
      const friend = profiles[otherId];
      if (!friend) return null;
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        mine: r.created_by === userId,
        friend,
        createdAt: new Date(r.created_at).getTime(),
        myChecks: marks[r.id]?.me ?? [],
        theirChecks: marks[r.id]?.them ?? [],
      } as SharedHabit;
    })
    .filter((h): h is SharedHabit => h !== null);

  const next: SharedCache = { userId, habits: withQueue(habits, queue), queue, at: Date.now() };
  await saveSharedCache(next);
  return next;
}

export async function inviteShared(friendId: string, title: string) {
  const userId = await myId();
  if (!userId) throw new Error('Inicia sesión primero.');
  const t = title.trim();
  if (!t) throw new Error('Ponle un nombre al hábito.');
  const { error } = await supabase.from('shared_habits').insert({ title: t.slice(0, 60), created_by: userId, partner: friendId });
  if (error) fail(error, 'No se pudo enviar la invitación. ¿Siguen siendo amigos?');
}

export async function acceptShared(id: string) {
  const { error } = await supabase.from('shared_habits').update({ status: 'active' }).eq('id', id);
  if (error) fail(error, 'No se pudo aceptar.');
}

/** Decline, cancel or leave: the habit goes away for both. */
export async function removeShared(id: string) {
  const { error } = await supabase.from('shared_habits').delete().eq('id', id);
  if (error) fail(error, 'No se pudo quitar el hábito.');
}

/**
 * Mark or unmark today. The cache changes first (Hoy updates at once, even
 * offline); the server gets it now or with the next load.
 */
export async function setSharedMark(id: string, checked: boolean, day = dayKey()): Promise<SharedCache> {
  const cache = await loadSharedCache();
  const queue = [...cache.queue.filter((q) => !(q.id === id && q.day === day)), { id, day, checked }];
  const optimistic: SharedCache = { ...cache, habits: withQueue(cache.habits, queue), queue };
  await saveSharedCache(optimistic);

  const userId = await myId();
  if (!userId) return optimistic;
  const left = await flushQueue(queue, userId);
  const done: SharedCache = { ...optimistic, queue: left };
  await saveSharedCache(done);
  return done;
}

/** Live: the other person marking, accepting or leaving reloads the list. */
export function subscribeShared(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const ping = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onChange, 400);
  };
  const channel: RealtimeChannel = supabase
    .channel('ritmo-shared')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_habits' }, ping)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_habit_checks' }, ping)
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
