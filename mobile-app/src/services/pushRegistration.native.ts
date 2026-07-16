import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { DevicePushRegistration } from '@/domain/accountSettings';

export async function getDevicePushRegistration(): Promise<DevicePushRegistration | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  const currentPermission = await Notifications.getPermissionsAsync();
  const permission = currentPermission.granted
    ? currentPermission
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  const easExtra = Constants.expoConfig?.extra?.eas as
    | { projectId?: string }
    | undefined;
  const projectId = Constants.easConfig?.projectId ?? easExtra?.projectId;
  if (!projectId) {
    throw new Error('The Expo push project identifier is not configured.');
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return {
    platform: Platform.OS,
    pushToken: token.data
  };
}
