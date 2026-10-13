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
};

export type FocusState = {
  taskId: string | null;
  /** Epoch ms when the countdown hits zero while running; null when paused. */
  endsAt: number | null;
  /** Remaining ms while paused. */
  remaining: number;
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
};

export const emptyFocus: FocusState = { taskId: null, endsAt: null, remaining: 0 };

export const defaultSettings: Settings = {
  name: '',
  gender: 'm',
  theme: 'system',
  onboarded: false,
  remindMorning: true,
  remindEvening: true,
};

const TASKS_KEY = 'ritmo.tasks.v1';
const FOCUS_KEY = 'ritmo.focus.v1';
const SETTINGS_KEY = 'ritmo.settings.v1';
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

export function tasksForDay(tasks: Task[], day: string) {
  return tasks
    .filter((t) => t.day === day)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt);
}

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

export const saveTasks = (tasks: Task[]) => writeJson(TASKS_KEY, tasks);

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

export const saveSettings = (s: Settings) => writeJson(SETTINGS_KEY, s);

/** Remaining ms of a focus block right now. */
export function remainingOf(f: FocusState, now = Date.now()) {
  return f.endsAt !== null ? Math.max(0, f.endsAt - now) : f.remaining;
}

/* Focus transitions shared by the Foco screen and the timer widget. */

export function focusOn(tasks: Task[], taskId: string): FocusState {
  const t = tasks.find((x) => x.id === taskId);
  return t ? { taskId, endsAt: null, remaining: t.minutes * 60_000 } : emptyFocus;
}

export function resumeFocus(f: FocusState, now = Date.now()): FocusState {
  return f.endsAt !== null ? f : { ...f, endsAt: now + f.remaining };
}

export function pauseFocus(f: FocusState, now = Date.now()): FocusState {
  return f.endsAt === null ? f : { ...f, endsAt: null, remaining: Math.max(0, f.endsAt - now) };
}

export function completeTask(tasks: Task[], id: string, now = Date.now()): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, done: true, doneAt: now } : t));
}
