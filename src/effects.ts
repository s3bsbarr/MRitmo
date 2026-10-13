/**
 * Everything Ritmo shows outside the app: the live focus notification, every
 * scheduled notification, and home-screen widgets. Safe on web and in headless JS.
 *
 * Scheduling is a rolling 7-day plan rebuilt from scratch on every change, so a
 * finished habit or a started task silently cancels its own reminder.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import RitmoLive from '../modules/ritmo-live/src/RitmoLiveModule';
import {
  atTime,
  dayKey,
  FocusState,
  Habit,
  progressOf,
  remainingOf,
  Settings,
  shiftDay,
  streakOf,
  Task,
  tasksForDay,
} from './data';
import { formatMinutes } from './format';

const native = Platform.OS !== 'web';
const isAndroid = Platform.OS === 'android';

export const CH = {
  focusEnd: 'ritmo_focus_end_v2',
  tasks: 'ritmo_tasks',
  reminders: 'ritmo_reminders',
  motivation: 'ritmo_motivation',
};

export const CAT = {
  focus: 'ritmo_focus',
  soon: 'ritmo_task_soon',
  overdue: 'ritmo_overdue',
  habit: 'ritmo_habit',
};

export const ACTION = {
  plus5: 'PLUS5',
  plus15: 'PLUS15',
  done: 'DONE',
  pause: 'PAUSE',
  start: 'START',
  startTask: 'START_TASK',
  snooze: 'SNOOZE15',
  checkHabit: 'CHECK_HABIT',
} as const;

const CHIME = 'ritmo_chime.wav';
const REST_KEY = 'ritmo.rest.v1';

let setupDone: Promise<void> | null = null;

/** Channels and action buttons. Idempotent; awaited before anything is scheduled. */
function setup() {
  if (!native) return Promise.resolve();
  if (setupDone) return setupDone;
  setupDone = (async () => {
    if (isAndroid) {
      await Notifications.setNotificationChannelAsync(CH.focusEnd, {
        name: 'Fin de bloque',
        description: 'Cuando se cumple el tiempo de la tarea en foco, con sonido.',
        importance: Notifications.AndroidImportance.HIGH,
        sound: CHIME,
        vibrationPattern: [0, 180, 120, 180],
      }).catch(() => {});
      await Notifications.setNotificationChannelAsync(CH.tasks, {
        name: 'Tareas',
        description: 'Tareas que están por empezar o que no empezaron a tiempo.',
        importance: Notifications.AndroidImportance.HIGH,
      }).catch(() => {});
      await Notifications.setNotificationChannelAsync(CH.reminders, {
        name: 'Recordatorios',
        description: 'Planear el día, cerrarlo, días libres y hábitos.',
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => {});
      await Notifications.setNotificationChannelAsync(CH.motivation, {
        name: 'Motivación',
        description: 'Un mensaje por la mañana y al cerrar un día completo.',
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => {});
    }
    const bg = { opensAppToForeground: false };
    await Notifications.setNotificationCategoryAsync(CAT.focus, [
      { identifier: ACTION.plus5, buttonTitle: '+5 min', options: bg },
      { identifier: ACTION.plus15, buttonTitle: '+15 min', options: bg },
      { identifier: ACTION.done, buttonTitle: 'Terminé', options: bg },
    ]).catch(() => {});
    await Notifications.setNotificationCategoryAsync(CAT.soon, [
      { identifier: ACTION.startTask, buttonTitle: 'Empezar ahora', options: bg },
    ]).catch(() => {});
    await Notifications.setNotificationCategoryAsync(CAT.overdue, [
      { identifier: ACTION.startTask, buttonTitle: 'Empezar', options: bg },
      { identifier: ACTION.snooze, buttonTitle: 'En 15 min', options: bg },
    ]).catch(() => {});
    await Notifications.setNotificationCategoryAsync(CAT.habit, [
      { identifier: ACTION.checkHabit, buttonTitle: 'Hecho', options: bg },
    ]).catch(() => {});
  })();
  return setupDone;
}

/** Show alerts even with the app open, so a finished block is never missed. */
export function configureNotifications() {
  if (!native) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  setup();
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!native) return false;
  try {
    await setup();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function hasPermission() {
  if (!native) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/* ─── Live focus notification ─────────────────────────────────────────────── */

export function syncFocus(focus: FocusState, tasks: Task[]) {
  if (!native) return;
  const task = tasks.find((t) => t.id === focus.taskId && !t.done) ?? null;
  const remaining = task ? remainingOf(focus) : 0;
  try {
    if (task && focus.endsAt !== null && remaining > 0) RitmoLive?.start(task.title, focus.endsAt);
    else if (task && focus.started && remaining > 0) RitmoLive?.pause(task.title, remaining);
    else RitmoLive?.stop();
  } catch {}
}

/* ─── Scheduled notifications ─────────────────────────────────────────────── */

export type Snapshot = { tasks: Task[]; habits: Habit[]; focus: FocusState; settings: Settings };

const MOTIVATION = [
  'Lo que hagas antes del mediodía define el resto del día. Empieza por lo que más pesa.',
  'No necesitas ganas para empezar. Necesitas empezar para que lleguen las ganas.',
  'Un bloque bien hecho vale más que un día entero de intenciones.',
  'La disciplina es elegir lo que quieres por encima de lo que quieres ahora.',
  'Hoy no tiene que ser perfecto. Tiene que estar hecho.',
  'Planea poco y cúmplelo todo. La confianza se construye cumpliendo.',
  'Cada tarea terminada es una promesa que te cumples a ti mismo.',
  'El progreso es silencioso. Se nota cuando miras la semana completa.',
  'Elige la tarea más difícil y dale el primer bloque del día.',
  'Constancia antes que intensidad. Un poco todos los días gana.',
];

const REST = [
  'Día completo. Desconéctate un rato: te lo ganaste.',
  'Cumpliste todo lo que planeaste. Descansa y mañana seguimos.',
  'Cerraste el día al 100 %. Así se construye el ritmo.',
];

function pick<T>(list: T[], key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

type Planned = Notifications.NotificationRequestInput & { at: number };

function date(at: number, channelId: string) {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId } as const;
}

/** Pure: every notification that should exist from `now`, given the current state. */
export function plan(snap: Snapshot, now = Date.now()): Planned[] {
  const { tasks, habits, focus, settings: s } = snap;
  const out: Planned[] = [];
  const add = (id: string, at: number, channelId: string, content: Notifications.NotificationContentInput) => {
    if (at > now + 5_000) out.push({ identifier: id, at, content, trigger: date(at, channelId) });
  };
  const today = dayKey(new Date(now));
  const who = s.name ? `, ${s.name}` : '';

  // Focus block: a heads-up two minutes before the end, then the end itself with sound.
  const focusTask = tasks.find((t) => t.id === focus.taskId && !t.done);
  if (focusTask && focus.endsAt !== null) {
    const data = { taskId: focusTask.id, url: 'ritmo://foco' };
    if ((focus.total ?? 0) > 4 * 60_000 || focus.endsAt - now > 4 * 60_000) {
      add('ritmo-focus-near', focus.endsAt - 2 * 60_000, CH.tasks, {
        title: 'Quedan 2 minutos',
        body: `${focusTask.title}. ¿Necesitas más tiempo?`,
        categoryIdentifier: CAT.focus,
        data,
      });
    }
    add('ritmo-focus-end', focus.endsAt, CH.focusEnd, {
      title: 'Tiempo cumplido',
      body: `"${focusTask.title}" llegó a su tiempo. ¿La terminaste o le das más?`,
      sound: CHIME,
      categoryIdentifier: CAT.focus,
      data,
    });
  }

  // Scheduled tasks: a lead notice, and a nudge if 5 minutes pass without starting.
  const startedId = focus.started ? focus.taskId : null;
  for (const t of tasks) {
    if (t.done || !t.at || t.id === startedId || t.at < now - 6 * 60_000) continue;
    const data = { taskId: t.id, url: 'ritmo://hoy' };
    if (s.taskLead > 0) {
      add(`ritmo-soon-${t.id}`, t.at - s.taskLead * 60_000, CH.tasks, {
        title: `En ${s.taskLead} min: ${t.title}`,
        body: `Bloque de ${formatMinutes(t.minutes)}. ¿Empezamos?`,
        categoryIdentifier: CAT.soon,
        data,
      });
    }
    if (s.remindOverdue) {
      add(`ritmo-late-${t.id}`, t.at + 5 * 60_000, CH.tasks, {
        title: `Sin empezar: ${t.title}`,
        body: 'Debía empezar hace 5 minutos. Empieza ahora o muévela 15 minutos.',
        categoryIdentifier: CAT.overdue,
        data,
      });
    }
  }

  // Daily rhythm over the next 7 days.
  for (let i = 0; i < 7; i++) {
    const day = shiftDay(today, i);
    const dayTasks = tasksForDay(tasks, day);
    const p = progressOf(dayTasks);

    if (s.remindMotivation) {
      add(`ritmo-motivation-${day}`, atTime(day, s.motivationTime), CH.motivation, {
        title: `Buenos días${who}`,
        body: pick(MOTIVATION, day),
        data: { url: 'ritmo://hoy' },
      });
    }

    if (s.remindMorning) {
      add(`ritmo-plan-${day}`, atTime(day, s.planTime), CH.reminders, {
        title: 'Planea tu día',
        body:
          dayTasks.length > 0
            ? `Tienes ${dayTasks.length} ${dayTasks.length === 1 ? 'tarea' : 'tareas'} (${formatMinutes(p.total)}). Revisa el orden y empieza.`
            : 'Agrega tus tareas y cuánto te tomará cada una.',
        data: { url: 'ritmo://hoy' },
      });
    }

    if (s.remindFreeDay && dayTasks.length === 0) {
      add(`ritmo-free-${day}`, atTime(day, '10:00'), CH.reminders, {
        title: 'Hoy no tienes tareas',
        body: '¿Quieres darle seguimiento a algo? Agrega una tarea y mantén el ritmo.',
        data: { url: 'ritmo://nueva' },
      });
    }

    if (s.remindEvening) {
      let body = 'Marca lo que terminaste y pasa lo pendiente a mañana.';
      if (i === 0) {
        const pendingTasks = dayTasks.filter((t) => !t.done).length;
        const pendingHabits = habits.filter((h) => !h.checks.includes(day)).length;
        const parts = [
          pendingTasks ? `${pendingTasks} ${pendingTasks === 1 ? 'tarea' : 'tareas'}` : '',
          pendingHabits ? `${pendingHabits} ${pendingHabits === 1 ? 'hábito' : 'hábitos'}` : '',
        ].filter(Boolean);
        if (parts.length) body = `Te ${parts.length > 1 || pendingTasks + pendingHabits > 1 ? 'faltan' : 'falta'} ${parts.join(' y ')}. Aún estás a tiempo.`;
        else if (dayTasks.length) body = 'Día completo. Revisa tu resumen y descansa.';
      }
      add(`ritmo-close-${day}`, atTime(day, s.closeTime), CH.reminders, { title: 'Cierra tu día', body, data: { url: 'ritmo://hoy' } });
    }

    for (const h of habits) {
      if (!h.time || h.checks.includes(day)) continue;
      const streak = i === 0 ? streakOf(h, day) : 0;
      add(`ritmo-habit-${h.id}-${day}`, atTime(day, h.time), CH.reminders, {
        title: h.title,
        body: streak > 0 ? `Llevas ${streak} ${streak === 1 ? 'día' : 'días'} de racha. No la rompas.` : 'Tu hábito de hoy. Márcalo cuando lo hagas.',
        categoryIdentifier: CAT.habit,
        data: { habitId: h.id, url: 'ritmo://hoy' },
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

let syncing: Promise<void> = Promise.resolve();

/** Replace every scheduled notification with the current plan. Serialized. */
export function syncSchedule(snap: Snapshot) {
  if (!native) return Promise.resolve();
  syncing = syncing.then(async () => {
    try {
      await setup();
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (!(await hasPermission())) return;
      for (const { at: _at, ...req } of plan(snap)) {
        await Notifications.scheduleNotificationAsync(req).catch(() => {});
      }
      // A pending "rest" notice survives replans.
      const rest = await readRest();
      if (rest && rest.at > Date.now()) await scheduleRest(rest.at, snap.settings);
    } catch {}
  });
  return syncing;
}

/* ─── Rest after a complete day ───────────────────────────────────────────── */

async function readRest(): Promise<{ day: string; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(REST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function scheduleRest(at: number, s: Settings) {
  await Notifications.scheduleNotificationAsync({
    identifier: 'ritmo-rest',
    content: { title: s.name ? `Bien hecho, ${s.name}` : 'Bien hecho', body: pick(REST, dayKey()), data: { url: 'ritmo://resumen' } },
    trigger: date(at, CH.motivation),
  }).catch(() => {});
}

/** Called when the app goes to the background: 15 minutes later, celebrate a 100 % day once. */
export async function onAppBackground(snap: Snapshot) {
  if (!native || !snap.settings.remindRest) return;
  const today = dayKey();
  const p = progressOf(tasksForDay(snap.tasks, today));
  const prev = await readRest();
  if (p.total === 0 || p.ratio < 1 || prev?.day === today) return;
  if (!(await hasPermission())) return;
  const at = Date.now() + 15 * 60_000;
  await AsyncStorage.setItem(REST_KEY, JSON.stringify({ day: today, at })).catch(() => {});
  await scheduleRest(at, snap.settings);
}

/** Called when the app returns: if the rest notice has not fired yet, hold it for the next close. */
export async function onAppForeground() {
  if (!native) return;
  const rest = await readRest();
  if (rest && rest.at > Date.now()) {
    await AsyncStorage.removeItem(REST_KEY).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync('ritmo-rest').catch(() => {});
  }
}

/* ─── Widgets ─────────────────────────────────────────────────────────────── */

let widgetTimer: ReturnType<typeof setTimeout> | null = null;

/** Redraw home-screen widgets. Debounced so a burst of edits redraws once. */
export function refreshWidgets() {
  if (!isAndroid) return;
  if (widgetTimer) clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => {
    widgetTimer = null;
    // Static require: dynamic import() was not reliable in the release bundle.
    const { updateAllWidgets } = require('./widgets/update') as typeof import('./widgets/update');
    updateAllWidgets().catch(() => {});
  }, 250);
}
