import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Permission UX is safe to ship before the server contract exists. We do not
 * request or persist a device token here: the API currently has no endpoint
 * to bind one to an authenticated user and no notification payload contract.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  const result = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  return result.granted;
}

export function configureNotificationPresentation(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') void Notifications.setNotificationChannelAsync('default', { name: 'Dari', importance: Notifications.AndroidImportance.DEFAULT });
}
