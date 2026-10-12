import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type Task = {
  id: string;
  title: string;
  minutes: number;
  day: string; // YYYY-MM-DD, local
  done: boolean;
  doneAt?: number;
  createdAt: number;
};

const KEY = 'ritmo.tasks.v1';
const PREF_KEY = 'ritmo.theme.v1';

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

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

async function readAll(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function readThemePref() {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) as 'system' | 'light' | 'dark' | null;
  } catch {
    return null;
  }
}

export async function writeThemePref(p: string) {
  try {
    await AsyncStorage.setItem(PREF_KEY, p);
  } catch {}
}

/** Progress weighted by duration: a 2 h task counts eight times a 15 min task. */
export function progressOf(tasks: Task[]) {
  const total = tasks.reduce((s, t) => s + t.minutes, 0);
  const done = tasks.filter((t) => t.done).reduce((s, t) => s + t.minutes, 0);
  return { total, done, ratio: total === 0 ? 0 : done / total };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(dayKey());

  useEffect(() => {
    readAll().then((t) => {
      setTasks(t);
      setReady(true);
    });
  }, []);

  // Roll the date over at midnight if the app stays open.
  useEffect(() => {
    const id = setInterval(() => {
      const k = dayKey();
      setToday((prev) => (prev === k ? prev : k));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const commit = useCallback((updater: (prev: Task[]) => Task[]) => {
    setTasks((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const add = useCallback(
    (title: string, minutes: number) =>
      commit((prev) => [
        ...prev,
        { id: uid(), title: title.trim(), minutes, day: today, done: false, createdAt: Date.now() },
      ]),
    [commit, today],
  );

  const toggle = useCallback(
    (id: string) =>
      commit((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : undefined } : t,
        ),
      ),
    [commit],
  );

  const complete = useCallback(
    (id: string) =>
      commit((prev) => prev.map((t) => (t.id === id ? { ...t, done: true, doneAt: Date.now() } : t))),
    [commit],
  );

  const remove = useCallback((id: string) => commit((prev) => prev.filter((t) => t.id !== id)), [commit]);

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.day === today)
        .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt),
    [tasks, today],
  );

  /** Unfinished tasks from earlier days that can be carried into today. */
  const carryover = useMemo(() => tasks.filter((t) => t.day < today && !t.done), [tasks, today]);

  const carryIntoToday = useCallback(
    () => commit((prev) => prev.map((t) => (t.day < today && !t.done ? { ...t, day: today } : t))),
    [commit, today],
  );

  const week = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const key = shiftDay(today, i - 6);
      const dayTasks = tasks.filter((t) => t.day === key);
      return { key, ...progressOf(dayTasks) };
    });
  }, [tasks, today]);

  return { ready, today, tasks, todayTasks, carryover, week, add, toggle, complete, remove, carryIntoToday };
}

export type TasksApi = ReturnType<typeof useTasks>;

const AVATAR_KEY = 'ritmo.avatar.v1';

export async function readAvatar() {
  try {
    const v = await AsyncStorage.getItem(AVATAR_KEY);
    return v === 'm' || v === 'f' ? v : null;
  } catch {
    return null;
  }
}

export async function writeAvatar(g: 'm' | 'f') {
  try {
    await AsyncStorage.setItem(AVATAR_KEY, g);
  } catch {}
}
