/**
 * Ritmo's haptics. Same API as expo-haptics, but on Android it uses the
 * system's own haptic constants (View.performHapticFeedback). On Samsung
 * those are the crisp, tuned clicks of One UI; the generic vibrator calls
 * feel soft and are easy to miss.
 */
import * as H from 'expo-haptics';
import { Platform } from 'react-native';

export const ImpactFeedbackStyle = H.ImpactFeedbackStyle;
export const NotificationFeedbackType = H.NotificationFeedbackType;

const android = Platform.OS === 'android';
const A = H.AndroidHaptics;

function run(type: H.AndroidHaptics, fallback: () => Promise<void>) {
  if (android) return H.performAndroidHapticsAsync(type).catch(fallback);
  return fallback();
}

/** A value ticks: tabs, chips, toggles. */
export function selectionAsync() {
  return run(A.Segment_Tick, () => H.selectionAsync());
}

/** Something was pressed or placed: create, complete, open. */
export function impactAsync(style: H.ImpactFeedbackStyle = H.ImpactFeedbackStyle.Light) {
  const type =
    style === H.ImpactFeedbackStyle.Heavy || style === H.ImpactFeedbackStyle.Rigid
      ? A.Long_Press
      : style === H.ImpactFeedbackStyle.Medium
        ? A.Long_Press
        : A.Virtual_Key;
  return run(type, () => H.impactAsync(style));
}

/** An outcome: success, warning, error. */
export function notificationAsync(type: H.NotificationFeedbackType = H.NotificationFeedbackType.Success) {
  const a = type === H.NotificationFeedbackType.Success ? A.Confirm : A.Reject;
  return run(a, () => H.notificationAsync(type));
}
