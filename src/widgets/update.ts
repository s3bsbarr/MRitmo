import { requestWidgetUpdate } from 'react-native-android-widget';
import { loadFocus, loadSettings, loadTasks } from '../data';
import { renderWidget, STATUS_WIDGET, TIMER_WIDGET } from './render';

/** Redraw every Ritmo widget on the home screen from the stored state. */
export async function updateAllWidgets() {
  const [tasks, focus, settings] = await Promise.all([loadTasks(), loadFocus(), loadSettings()]);
  const snap = { tasks, focus, settings };
  for (const widgetName of [STATUS_WIDGET, TIMER_WIDGET]) {
    await requestWidgetUpdate({
      widgetName,
      renderWidget: (info) => renderWidget(info, snap),
      widgetNotFound: () => {},
    }).catch(() => {});
  }
}
