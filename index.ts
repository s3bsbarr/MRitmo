import { registerRootComponent } from 'expo';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import App from './App';
import { applyAction } from './src/actions';

registerRootComponent(App);

/**
 * Notification buttons (+5 min, Terminé, Empezar, Hecho…) run here when the app
 * is in the background or closed. Must be defined at module scope.
 */
const NOTIFICATION_TASK = 'ritmo-notification-actions';

if (Platform.OS !== 'web') {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data }) => {
    if (data && 'actionIdentifier' in data) {
      const response = data as unknown as Notifications.NotificationResponse;
      const action = response.actionIdentifier;
      if (action && action !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
        const payload = (response.notification?.request?.content?.data ?? {}) as { taskId?: string; habitId?: string; sharedId?: string };
        await applyAction(action, payload, { immediate: true });
        await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
      }
    }
  });
  Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => {});
}

// Home-screen widgets (and live-notification buttons) render and act in headless JS.
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
