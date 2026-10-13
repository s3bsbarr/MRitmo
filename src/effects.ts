/**
 * Side effects that mirror app state outside the app: the live focus
 * notification, the "block finished" alert, daily reminders and home-screen
 * widgets. Every function is safe to call on web and from headless JS.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import RitmoLive from '../modules/ritmo-live/src/RitmoLiveModule';
import { FocusState, remainingOf, Settings, Task } from './data';

const isAndroid = Platform.OS === 'android';

const CH_FOCUS_END = 'ritmo_focus_end';
const CH_REMINDERS = 'ritmo_reminders';
const ID_FOCUS_END = 'ritmo-focus-end';
const ID_MORNING = 'ritmo-morning';
const ID_EVENING = 'ritmo-evening';

let channelsReady = false;

async function ensureChannels() {
  if (!isAndroid || channelsReady) return;
  channelsReady = true;
  await Notifications.setNotificationChannelAsync(CH_FOCUS_END, {
    name: 'Bloque terminado',
    description: 'Avisa cuando se cumple el tiempo de la tarea en foco.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
  }).catch(() => {});
  await Notifications.setNotificationChannelAsync(CH_REMINDERS, {
    name: 'Recordatorios',
    description: 'Planear el día por la mañana y revisarlo por la noche.',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
}

/** Show alerts even when the app is open, so a finished block is never missed. */
export function configureNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await ensureChannels();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

async function hasPermission() {
  if (Platform.OS === 'web') return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Mirror the focus timer: live countdown notification plus an alert at zero. */
export async function syncFocus(focus: FocusState, tasks: Task[]) {
  if (Platform.OS === 'web') return;
  const task = tasks.find((t) => t.id === focus.taskId && !t.done) ?? null;
  const remaining = task ? remainingOf(focus) : 0;
  const running = task !== null && focus.endsAt !== null && remaining > 0;

  try {
    if (running) RitmoLive?.start(task.title, focus.endsAt!);
    else if (task && remaining > 0) RitmoLive?.pause(task.title, remaining);
    else RitmoLive?.stop();
  } catch {}

  try {
    await Notifications.cancelScheduledNotificationAsync(ID_FOCUS_END);
    if (running && (await hasPermission())) {
      await ensureChannels();
      await Notifications.scheduleNotificationAsync({
        identifier: ID_FOCUS_END,
        content: {
          title: 'Bloque terminado',
          body: `Cumpliste el tiempo de "${task.title}". Márcala como hecha si la terminaste.`,
          data: { url: 'ritmo://foco' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: focus.endsAt!, channelId: CH_FOCUS_END },
      });
    }
  } catch {}
}

/** Daily nudges at fixed, calm times. Re-applied whenever settings change. */
export async function syncReminders(settings: Settings) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(ID_MORNING);
    await Notifications.cancelScheduledNotificationAsync(ID_EVENING);
    if (!(await hasPermission())) return;
    await ensureChannels();
    const who = settings.name ? `, ${settings.name}` : '';
    if (settings.remindMorning) {
      await Notifications.scheduleNotificationAsync({
        identifier: ID_MORNING,
        content: { title: `Buenos días${who}`, body: 'Planea tu día: agrega tus tareas y cuánto te tomará cada una.', data: { url: 'ritmo://hoy' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 0, channelId: CH_REMINDERS },
      });
    }
    if (settings.remindEvening) {
      await Notifications.scheduleNotificationAsync({
        identifier: ID_EVENING,
        content: { title: 'Cierra tu día', body: 'Marca lo que terminaste y pasa lo pendiente a mañana.', data: { url: 'ritmo://hoy' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 30, channelId: CH_REMINDERS },
      });
    }
  } catch {}
}

let widgetTimer: ReturnType<typeof setTimeout> | null = null;

/** Redraw home-screen widgets. Debounced so a burst of edits redraws once. */
export function refreshWidgets() {
  if (!isAndroid) return;
  if (widgetTimer) clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => {
    widgetTimer = null;
    // Loaded lazily so the widget renderer never ships in the web preview.
    import('./widgets/update').then((m) => m.updateAllWidgets()).catch(() => {});
  }, 300);
}
