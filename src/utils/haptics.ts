import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Thin wrappers around expo-haptics that no-op on web and never reject, so
 * call sites can fire them without guarding or awaiting.
 */
const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export function hapticLight() {
  if (!isSupported) {
    return;
  }

  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function hapticSuccess() {
  if (!isSupported) {
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticWarning() {
  if (!isSupported) {
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

export function hapticSelection() {
  if (!isSupported) {
    return;
  }

  void Haptics.selectionAsync().catch(() => undefined);
}
