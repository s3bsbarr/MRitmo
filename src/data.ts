/**
 * Shared persisted state. Pure functions with no React, so the app, the home
 * screen widgets (headless JS) and notifications all read and write one source.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Task = {
  id: string;
  title: string;
  minutes: number;
  day: string; // YYYY-MM-DD, local
  done: boolean;
  doneAt?: number;
  createdAt: number;
  /** Scheduled start (epoch ms). Absent means "ahora": any time that day. */
  at?: number;
};

/** A habit repeats every day; it builds a streak and never counts toward the day's %. */
export type Habit = {
  id: string;
  title: string;
  /** Optional daily reminder, "HH:MM" 24 h. */
  time?: string;
  createdAt: number;
  /** Days checked, YYYY-MM-DD. */
  checks: string[];
};

export type FocusState = {
  taskId: string | null;
  /** Epoch ms when the countdown hits zero while running; null when paused. */
  endsAt: number | null;
  /** Remaining ms while paused. */
  remaining: number;
  /** Full block length in ms, including any extra time added. */
  total?: number;
  /** True once the countdown has been started at least once. */
  started?: boolean;
};

export type ThemePref = 'system' | 'light' | 'dark';
export type Gender = 'm' | 'f';

export type Settings = {
  name: string;
  gender: Gender;
  theme: ThemePref;
  onboarded: boolean;
  remindMorning: boolean;
  remindEvening: boolean;
  /** "HH:MM" 24 h. */
  planTime: string;
  closeTime: string;
  motivationTime: string;
  remindMotivation: boolean;
  remindFreeDay: boolean;
  remindRest: boolean;
  /** Minutes before a scheduled task to notify; 0 turns it off. */
  taskLead: number;
  remindOverdue: boolean;
  /** Server push about friends: requests and acceptances. */
  remindFriends: boolean;
};

export const emptyFocus: FocusState = { taskId: null, endsAt: null, remaining: 0 };

export const defaultSettings: Settings = {
  name: '',
  gender: 'm',
  theme: 'system',
  onboarded: false,
  remindMorning: true,
  remindEvening: true,
  planTime: '08:00',
  closeTime: '20:30',
  motivationTime: '06:30',
  remindMotivation: true,
  remindFreeDay: true,
  remindRest: true,
  taskLead: 10,
  remindOverdue: true,
  remindFriends: true,
};

const TASKS_KEY = 'ritmo.tasks.v1';
const FOCUS_KEY = 'ritmo.focus.v1';
const SETTINGS_KEY = 'ritmo.settings.v1';
const HABITS_KEY = 'ritmo.habits.v1';
const META_KEY = 'ritmo.sync.v1';
const DELETED_KEY = 'ritmo.deleted.v1';
// Pre-settings keys from build 1–2, migrated on first read.
const LEGACY_THEME_KEY = 'ritmo.theme.v1';
const LEGACY_AVATAR_KEY = 'ritmo.avatar.v1';

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDay(key: string, delta: number) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Progress weighted by duration: a 2 h task counts eight times a 15 min task. */
export function progressOf(tasks: Task[]) {
  const total = tasks.reduce((s, t) => s + t.minutes, 0);
  const done = tasks.filter((t) => t.done).reduce((s, t) => s + t.minutes, 0);
  return { total, done, ratio: total === 0 ? 0 : done / total };
}

/** Pending first; within each group, scheduled tasks by time, then the rest in creation order. */
export function tasksForDay(tasks: Task[], day: string) {
  return tasks
    .filter((t) => t.day === day)
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt - b.createdAt,
    );
}

/** Tasks scheduled after today, soonest first. */
export function upcomingTasks(tasks: Task[], today = dayKey()) {
  return tasks
    .filter((t) => t.day > today && !t.done)
    .sort((a, b) => a.day.localeCompare(b.day) || (a.at ?? 0) - (b.at ?? 0) || a.createdAt - b.createdAt);
}

export function hhmm(time: string) {
  const [h, m] = time.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

/** Epoch ms for a YYYY-MM-DD day at "HH:MM" local time. */
export function atTime(day: string, time: string) {
  const [y, mo, d] = day.split('-').map(Number);
  const { h, m } = hhmm(time);
  return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
}

/* Habits */

export function streakOf(h: Habit, today = dayKey()) {
  const set = new Set(h.checks);
  // An unchecked today does not break the streak yet; count from yesterday.
  let day = set.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = shiftDay(day, -1);
  }
  return n;
}

export function bestStreakOf(h: Habit) {
  const days = [...new Set(h.checks)].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of days) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Share of the last `days` days (capped at the habit's age) that were checked. */
export function consistencyOf(h: Habit, days = 30, today = dayKey()) {
  const created = dayKey(new Date(h.createdAt));
  const set = new Set(h.checks);
  let possible = 0;
  let hit = 0;
  for (let i = 0; i < days; i++) {
    const d = shiftDay(today, -i);
    if (d < created) break;
    possible++;
    if (set.has(d)) hit++;
  }
  return possible === 0 ? 0 : hit / possible;
}

export async function loadHabits(): Promise<Habit[]> {
  const h = await readJson<Habit[]>(HABITS_KEY, []);
  return Array.isArray(h) ? h : [];
}

export const saveHabits = async (h: Habit[]) => {
  await writeJson(HABITS_KEY, h);
  await touch();
};

export function nextPending(tasks: Task[], day = dayKey()) {
  return tasksForDay(tasks, day).find((t) => !t.done) ?? null;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function loadTasks(): Promise<Task[]> {
  const t = await readJson<Task[]>(TASKS_KEY, []);
  return Array.isArray(t) ? t : [];
}

export const saveTasks = async (tasks: Task[]) => {
  await writeJson(TASKS_KEY, tasks);
  await touch();
};

export async function loadFocus(): Promise<FocusState> {
  const f = await readJson<FocusState>(FOCUS_KEY, emptyFocus);
  return f && typeof f === 'object' ? { ...emptyFocus, ...f } : emptyFocus;
}

export const saveFocus = (f: FocusState) => writeJson(FOCUS_KEY, f);

export async function loadSettings(): Promise<Settings> {
  const stored = await readJson<Partial<Settings> | null>(SETTINGS_KEY, null);
  if (stored) return { ...defaultSettings, ...stored };
  // First run on this version: carry over theme and character from older builds.
  const migrated = { ...defaultSettings };
  try {
    const [theme, avatar, tasks] = await Promise.all([
      AsyncStorage.getItem(LEGACY_THEME_KEY),
      AsyncStorage.getItem(LEGACY_AVATAR_KEY),
      AsyncStorage.getItem(TASKS_KEY),
    ]);
    if (theme === 'light' || theme === 'dark' || theme === 'system') migrated.theme = theme;
    if (avatar === 'm' || avatar === 'f') migrated.gender = avatar;
    // Someone who already used the app skips the welcome but still gets asked their name in settings.
    if (tasks) migrated.onboarded = true;
  } catch {}
  return migrated;
}

export const saveSettings = async (s: Settings) => {
  await writeJson(SETTINGS_KEY, s);
  await touch();
};

/** Remaining ms of a focus block right now. */
export function remainingOf(f: FocusState, now = Date.now()) {
  return f.endsAt !== null ? Math.max(0, f.endsAt - now) : f.remaining;
}

/* Focus transitions shared by the Foco screen and the timer widget. */

export function focusOn(tasks: Task[], taskId: string): FocusState {
  const t = tasks.find((x) => x.id === taskId);
  if (!t) return emptyFocus;
  const total = t.minutes * 60_000;
  return { taskId, endsAt: null, remaining: total, total, started: false };
}

export function resumeFocus(f: FocusState, now = Date.now()): FocusState {
  return f.endsAt !== null ? f : { ...f, endsAt: now + f.remaining, started: true };
}

/** Add time to the block. If it already ran out, it restarts counting from now. */
export function extendFocus(f: FocusState, ms: number, now = Date.now()): FocusState {
  const total = (f.total ?? f.remaining) + ms;
  if (f.endsAt !== null) return { ...f, endsAt: Math.max(f.endsAt, now) + ms, total, started: true };
  return { ...f, remaining: f.remaining + ms, total };
}

export function totalOf(f: FocusState, tasks: Task[]) {
  if (f.total) return f.total;
  const t = tasks.find((x) => x.id === f.taskId);
  return (t?.minutes ?? 0) * 60_000;
}

export function pauseFocus(f: FocusState, now = Date.now()): FocusState {
  return f.endsAt === null ? f : { ...f, endsAt: null, remaining: Math.max(0, f.endsAt - now) };
}

export function completeTask(tasks: Task[], id: string, now = Date.now()): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, done: true, doneAt: now } : t));
}

/* ─── Account sync ─────────────────────────────────────────────────────────
 * The whole state travels as one document. Every local save stamps
 * `updatedAt`; deletions are remembered so they never come back from the
 * other side. */

export type SyncMeta = { updatedAt: number; lastSync?: number };

export type SyncState = {
  tasks: Task[];
  habits: Habit[];
  settings: Settings;
  deleted: string[];
  updatedAt: number;
};

export async function loadMeta(): Promise<SyncMeta> {
  return readJson<SyncMeta>(META_KEY, { updatedAt: 0 });
}

export async function saveMeta(m: SyncMeta) {
  await writeJson(META_KEY, m);
}

/** Mark local data as changed now. */
export async function touch(now = Date.now()) {
  const m = await loadMeta();
  await writeJson(META_KEY, { ...m, updatedAt: now });
}

export async function loadDeleted(): Promise<string[]> {
  const d = await readJson<string[]>(DELETED_KEY, []);
  return Array.isArray(d) ? d : [];
}

export async function rememberDeleted(id: string) {
  const d = await loadDeleted();
  if (!d.includes(id)) await writeJson(DELETED_KEY, [...d, id].slice(-3000));
}

export async function loadSyncState(): Promise<SyncState> {
  const [tasks, habits, settings, deleted, meta] = await Promise.all([loadTasks(), loadHabits(), loadSettings(), loadDeleted(), loadMeta()]);
  return { tasks, habits, settings, deleted, updatedAt: meta.updatedAt };
}

/** Write a merged state back without stamping it as a new local change. */
export async function applySyncState(st: SyncState, lastSync = Date.now()) {
  await Promise.all([
    writeJson(TASKS_KEY, st.tasks),
    writeJson(HABITS_KEY, st.habits),
    writeJson(SETTINGS_KEY, st.settings),
    writeJson(DELETED_KEY, st.deleted),
  ]);
  await saveMeta({ updatedAt: st.updatedAt, lastSync });
}

function unionById<T extends { id: string }>(newer: T[], older: T[], deleted: Set<string>) {
  const seen = new Set(newer.map((x) => x.id));
  return [...newer, ...older.filter((x) => !seen.has(x.id))].filter((x) => !deleted.has(x.id));
}

/**
 * Pure merge. The side changed most recently wins any conflict; items that
 * exist only on the other side are kept (created offline elsewhere); deleted
 * ids stay deleted on both.
 */
export function mergeState(local: SyncState, remote: SyncState): SyncState {
  const localNewer = local.updatedAt >= remote.updatedAt;
  const newer = localNewer ? local : remote;
  const older = localNewer ? remote : local;
  const deletedList = [...new Set([...(local.deleted ?? []), ...(remote.deleted ?? [])])].slice(-3000);
  const deleted = new Set(deletedList);
  return {
    tasks: unionById(newer.tasks ?? [], older.tasks ?? [], deleted),
    habits: unionById(newer.habits ?? [], older.habits ?? [], deleted),
    settings: {
      ...defaultSettings,
      ...older.settings,
      ...newer.settings,
      onboarded: Boolean(local.settings?.onboarded || remote.settings?.onboarded),
    },
    deleted: deletedList,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}
