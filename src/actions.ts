/**
 * The single place where outside-the-app actions change state: widget buttons,
 * live-notification buttons and scheduled-notification buttons all land here,
 * with the app open or closed.
 */
import { Platform } from 'react-native';
import {
  completeTask,
  dayKey,
  emptyFocus,
  extendFocus,
  focusOn,
  loadFocus,
  loadHabits,
  loadSettings,
  loadTasks,
  nextPending,
  pauseFocus,
  resumeFocus,
  saveFocus,
  saveHabits,
  saveTasks,
} from './data';
import { ACTION, refreshWidgets, Snapshot, syncFocus, syncSchedule } from './effects';

export async function loadSnapshot(): Promise<Snapshot> {
  const [tasks, habits, focus, settings] = await Promise.all([loadTasks(), loadHabits(), loadFocus(), loadSettings()]);
  return { tasks, habits, focus, settings };
}

/**
 * Re-apply every external mirror from what is stored right now.
 * Headless callers pass `immediate` so widgets redraw before the task ends.
 */
export async function resyncAll(snap?: Snapshot, opts: { immediate?: boolean } = {}) {
  const s = snap ?? (await loadSnapshot());
  syncFocus(s.focus, s.tasks);
  if (opts.immediate && Platform.OS === 'android') {
    const { updateAllWidgets } = require('./widgets/update') as typeof import('./widgets/update');
    await updateAllWidgets().catch(() => {});
  } else refreshWidgets();
  await syncSchedule(s);
  return s;
}

export async function applyAction(action: string, payload: { taskId?: string; habitId?: string } = {}, opts: { immediate?: boolean } = {}) {
  const snap = await loadSnapshot();
  let { tasks, habits, focus } = snap;
  const now = Date.now();
  const current = tasks.find((t) => t.id === focus.taskId && !t.done);

  switch (action) {
    case ACTION.start: {
      if (current) focus = resumeFocus(focus, now);
      else {
        const next = nextPending(tasks);
        if (next) focus = resumeFocus(focusOn(tasks, next.id), now);
      }
      break;
    }
    case ACTION.startTask: {
      const t = tasks.find((x) => x.id === payload.taskId && !x.done);
      if (t) {
        // Starting a task from another day moves it to today.
        if (t.day !== dayKey()) tasks = tasks.map((x) => (x.id === t.id ? { ...x, day: dayKey() } : x));
        focus = focus.taskId === t.id ? resumeFocus(focus, now) : resumeFocus(focusOn(tasks, t.id), now);
      }
      break;
    }
    case ACTION.pause:
      focus = pauseFocus(focus, now);
      break;
    case ACTION.plus5:
    case ACTION.plus15:
      if (current) focus = extendFocus(focus, (action === ACTION.plus5 ? 5 : 15) * 60_000, now);
      break;
    case ACTION.done: {
      const id = payload.taskId ?? current?.id;
      if (id) {
        tasks = completeTask(tasks, id, now);
        if (focus.taskId === id) focus = emptyFocus;
      }
      break;
    }
    case ACTION.snooze: {
      tasks = tasks.map((t) => (t.id === payload.taskId && !t.done ? { ...t, at: Math.max(t.at ?? now, now) + 15 * 60_000 } : t));
      break;
    }
    case ACTION.checkHabit: {
      const today = dayKey();
      habits = habits.map((h) => (h.id === payload.habitId && !h.checks.includes(today) ? { ...h, checks: [...h.checks, today] } : h));
      break;
    }
    default:
      return snap;
  }

  await Promise.all([saveTasks(tasks), saveHabits(habits), saveFocus(focus)]);
  return resyncAll({ ...snap, tasks, habits, focus }, opts);
}
