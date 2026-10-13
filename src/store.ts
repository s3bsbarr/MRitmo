import { useCallback, useEffect, useMemo, useState } from 'react';
import { dayKey, loadTasks, progressOf, saveTasks, shiftDay, Task, tasksForDay, uid } from './data';
import { refreshWidgets } from './effects';

export { dayKey, progressOf, shiftDay };
export type { Task };

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
      saveTasks(next).then(refreshWidgets);
      return next;
    });
  }, []);

  const add = useCallback(
    (title: string, minutes: number) =>
      commit((prev) => [...prev, { id: uid(), title: title.trim(), minutes, day: today, done: false, createdAt: Date.now() }]),
    [commit, today],
  );

  const toggle = useCallback(
    (id: string) =>
      commit((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? Date.now() : undefined } : t))),
    [commit],
  );

  const complete = useCallback(
    (id: string) => commit((prev) => prev.map((t) => (t.id === id ? { ...t, done: true, doneAt: Date.now() } : t))),
    [commit],
  );

  const remove = useCallback((id: string) => commit((prev) => prev.filter((t) => t.id !== id)), [commit]);

  const todayTasks = useMemo(() => tasksForDay(tasks, today), [tasks, today]);

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

  return { ready, today, tasks, todayTasks, carryover, week, add, toggle, complete, remove, carryIntoToday, reload };
}

export type TasksApi = ReturnType<typeof useTasks>;
