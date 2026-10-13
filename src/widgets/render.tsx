import type { WidgetInfo, WidgetRepresentation } from 'react-native-android-widget';
import { dayKey, FocusState, nextPending, progressOf, remainingOf, Settings, Task, tasksForDay } from '../data';
import { W, WC } from './colors';
import { StatusWidget } from './StatusWidget';
import { TimerState, TimerWidget } from './TimerWidget';

export const STATUS_WIDGET = 'RitmoEstado';
export const TIMER_WIDGET = 'RitmoFoco';

export type Snapshot = { tasks: Task[]; focus: FocusState; settings: Settings };

export function timerStateOf({ tasks, focus }: Snapshot, now = Date.now()): TimerState {
  const task = tasks.find((t) => t.id === focus.taskId && !t.done);
  if (task) {
    const remainingMs = remainingOf(focus, now);
    if (remainingMs <= 0) return { kind: 'finished', title: task.title };
    if (focus.endsAt !== null) return { kind: 'running', title: task.title, endsAt: focus.endsAt, remainingMs };
    // A selected but never-started task reads as "next" with its own duration.
    if (remainingMs === task.minutes * 60_000) return { kind: 'next', title: task.title, minutes: task.minutes };
    return { kind: 'paused', title: task.title, remainingMs };
  }
  const next = nextPending(tasks);
  return next ? { kind: 'next', title: next.title, minutes: next.minutes } : { kind: 'empty' };
}

/** Follow the app's theme setting; "system" lets Android pick per its dark mode. */
function themed(settings: Settings, draw: (c: WC) => React.JSX.Element): WidgetRepresentation {
  if (settings.theme === 'light') return draw(W.light);
  if (settings.theme === 'dark') return draw(W.dark);
  return { light: draw(W.light), dark: draw(W.dark) };
}

export function renderWidget(info: Pick<WidgetInfo, 'widgetName' | 'width' | 'height'>, snap: Snapshot): WidgetRepresentation {
  if (info.widgetName === TIMER_WIDGET) {
    const state = timerStateOf(snap);
    return themed(snap.settings, (c) => <TimerWidget c={c} state={state} height={info.height} />);
  }
  const today = tasksForDay(snap.tasks, dayKey());
  const p = progressOf(today);
  return themed(snap.settings, (c) => (
    <StatusWidget
      c={c}
      gender={snap.settings.gender}
      done={p.done}
      total={p.total}
      ratio={p.ratio}
      hasTasks={today.length > 0}
      width={info.width}
      height={info.height}
    />
  ));
}
