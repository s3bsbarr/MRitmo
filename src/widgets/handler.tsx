import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import {
  completeTask,
  emptyFocus,
  focusOn,
  loadFocus,
  loadSettings,
  loadTasks,
  nextPending,
  pauseFocus,
  resumeFocus,
  saveFocus,
  saveTasks,
} from '../data';
import { syncFocus } from '../effects';
import { renderWidget } from './render';
import { updateAllWidgets } from './update';

/**
 * Runs headless when a widget is added, resized, refreshed or tapped,
 * so Iniciar / Pausar / Terminé work with the app closed.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction } = props;
  let [tasks, focus, settings] = await Promise.all([loadTasks(), loadFocus(), loadSettings()]);

  if (widgetAction === 'WIDGET_CLICK' && clickAction) {
    const current = tasks.find((t) => t.id === focus.taskId && !t.done);

    if (clickAction === 'START') {
      if (current) focus = resumeFocus(focus);
      else {
        const next = nextPending(tasks);
        if (next) focus = resumeFocus(focusOn(tasks, next.id));
      }
    } else if (clickAction === 'PAUSE') {
      focus = pauseFocus(focus);
    } else if (clickAction === 'DONE' && current) {
      tasks = completeTask(tasks, current.id);
      focus = emptyFocus;
      await saveTasks(tasks);
    }

    await saveFocus(focus);
    await syncFocus(focus, tasks);
    // The tapped widget redraws below; the other one needs a nudge too.
    await updateAllWidgets();
  }

  if (widgetAction === 'WIDGET_DELETED') return;
  props.renderWidget(renderWidget(widgetInfo, { tasks, focus, settings }));
}
