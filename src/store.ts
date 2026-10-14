import { useCallback, useEffect, useMemo, useState } from 'react';
import { dayKey, Habit, loadHabits, loadTasks, progressOf, rememberDeleted, saveHabits, saveTasks, shiftDay, Task, tasksForDay, uid, upcomingTasks } from './data';

import {
  acceptShared,
  activeShared,
  fetchShared,
  inviteShared,
  loadSharedCache,
  removeShared,
  setSharedMark,
  SharedHabit,
  subscribeShared,
} from './shared';

export { dayKey, progressOf, shiftDay };
export type { Habit, Task };

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(dayKey());

  /** Re-read from storage: a widget may have changed tasks while the app was closed. */
  const reload = useCallback(async () => {
    const t = await loadTasks();
    setTasks(t);
    setReady(true);
    setToday(dayKey());
    return t;
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

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
      saveTasks(next);
      return next;
    });
  }, []);

  const add = useCallback(
    (title: string, minutes: number, day: string = today, at?: number) =>
      commit((prev) => [...prev, { id: uid(), title: title.trim(), minutes, day, at, done: false, createdAt: Date.now() }]),
    [commit, today],
  );

  const toggle = useCallback(
    (id: string) =>
      commit((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : undefined } : t))),
    [commit],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<Task, 'title' | 'minutes' | 'day' | 'at'>>) =>
      commit((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, title: (patch.title ?? t.title).trim() } : t))),
    [commit],
  );

  const complete = useCallback(
    (id: string) => commit((prev) => prev.map((t) => (t.id === id ? { ...t, done: true, doneAt: Date.now() } : t))),
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      rememberDeleted(id);
      commit((prev) => prev.filter((t) => t.id !== id));
    },
    [commit],
  );

  const todayTasks = useMemo(() => tasksForDay(tasks, today), [tasks, today]);

  const upcoming = useMemo(() => upcomingTasks(tasks, today), [tasks, today]);

  /** Unfinished tasks from earlier days that can be carried into today. */
  const carryover = useMemo(() => tasks.filter((t) => t.day < today && !t.done), [tasks, today]);

  const carryIntoToday = useCallback(
    () => commit((prev) => prev.map((t) => (t.day < today && !t.done ? { ...t, day: today } : t))),
    [commit, today],
  );

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const key = shiftDay(today, i - 6);
        return { key, ...progressOf(tasks.filter((t) => t.day === key)) };
      }),
    [tasks, today],
  );

  return { ready, today, tasks, todayTasks, upcoming, carryover, week, add, update, toggle, complete, remove, carryIntoToday, reload };
}

export type TasksApi = ReturnType<typeof useTasks>;

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const h = await loadHabits();
    setHabits(h);
    setReady(true);
    return h;
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const commit = useCallback((updater: (prev: Habit[]) => Habit[]) => {
    setHabits((prev) => {
      const next = updater(prev);
      saveHabits(next);
      return next;
    });
  }, []);

  const add = useCallback(
    (title: string, time?: string) => commit((prev) => [...prev, { id: uid(), title: title.trim(), time, createdAt: Date.now(), checks: [] }]),
    [commit],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<Habit, 'title' | 'time'>>) =>
      commit((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch, title: (patch.title ?? h.title).trim() } : h))),
    [commit],
  );

  const toggleToday = useCallback(
    (id: string) => {
      const today = dayKey();
      commit((prev) =>
        prev.map((h) =>
          h.id !== id ? h : { ...h, checks: h.checks.includes(today) ? h.checks.filter((d) => d !== today) : [...h.checks, today] },
        ),
      );
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      rememberDeleted(id);
      commit((prev) => prev.filter((h) => h.id !== id));
    },
    [commit],
  );

  return { ready, habits, add, update, toggleToday, remove, reload };
}

export type HabitsApi = ReturnType<typeof useHabits>;

/**
 * Shared habits (1.7): the cache first, then the server, then live changes.
 * `signedIn` turns the server part on; signed out, the list is empty.
 */
export function useShared(signedIn: boolean) {
  const [habits, setHabits] = useState<SharedHabit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const c = await fetchShared();
      setHabits(c.habits);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // Signed out (or the session not restored yet): nothing on screen. The cache
    // stays until sign-out clears it, so a slow start doesn't wipe offline data.
    if (!signedIn) {
      setHabits([]);
      return;
    }
    // Show what the phone knows right away; the server catches up.
    loadSharedCache().then((c) => setHabits((prev) => (prev.length ? prev : c.habits)));
    reload();
    return subscribeShared(reload);
  }, [signedIn, reload]);

  const toggleToday = useCallback(async (id: string) => {
    const today = dayKey();
    const h = (await loadSharedCache()).habits.find((x) => x.id === id);
    const checked = !(h?.myChecks.includes(today) ?? false);
    // Instant on screen; the write follows.
    setHabits((prev) =>
      prev.map((x) => (x.id !== id ? x : { ...x, myChecks: checked ? [...x.myChecks.filter((d) => d !== today), today] : x.myChecks.filter((d) => d !== today) })),
    );
    const c = await setSharedMark(id, checked, today);
    setHabits(c.habits);
  }, []);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      await fn();
      await reload();
    },
    [reload],
  );

  return {
    habits,
    active: useMemo(() => activeShared(habits), [habits]),
    error,
    reload,
    toggleToday,
    invite: (friendId: string, title: string) => run(() => inviteShared(friendId, title)),
    accept: (id: string) => run(() => acceptShared(id)),
    remove: (id: string) => run(() => removeShared(id)),
  };
}

export type SharedApi = ReturnType<typeof useShared>;
