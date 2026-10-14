import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { applyAction, loadSnapshot } from '../actions';
import { renderWidget } from './render';

/**
 * Runs headless when a widget is added, resized, refreshed or tapped, and when a
 * button on the live focus notification is pressed (sent with widgetId -1).
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction, clickActionData } = props;

  let snap;
  if (widgetAction === 'WIDGET_CLICK' && clickAction) {
    const payload = (clickActionData ?? {}) as { taskId?: string; habitId?: string; sharedId?: string };
    snap = await applyAction(clickAction, payload, { immediate: true });
  } else {
    snap = await loadSnapshot();
  }

  // Taps from the notification have no widget of their own to redraw.
  if (widgetAction === 'WIDGET_DELETED' || widgetInfo.widgetId < 0) return;
  props.renderWidget(renderWidget(widgetInfo, snap));
}
