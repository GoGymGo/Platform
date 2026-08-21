import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { competitionConfig } from '@/config/competition';
import type { DevicePushRegistration } from '@/domain/accountSettings';

export async function getDevicePushRegistration(): Promise<DevicePushRegistration | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

  const permission = await Notifications.getPermissionsAsync();
  if (
    !permission.granted &&
    permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL &&
    permission.ios?.status !== Notifications.IosAuthorizationStatus.EPHEMERAL
  ) return null;

  const easExtra = Constants.expoConfig?.extra?.eas as
    | { projectId?: string }
    | undefined;
  const projectId = Constants.easConfig?.projectId ?? easExtra?.projectId;
  if (!projectId) {
    throw new Error('The Expo push project identifier is not configured.');
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  let installationId = await AsyncStorage.getItem(
    competitionConfig.pushInstallationIdStorageKey
  );
  if (!installationId) {
    installationId = Crypto.randomUUID();
    await AsyncStorage.setItem(
      competitionConfig.pushInstallationIdStorageKey,
      installationId
    );
  }
  return {
    installationId,
    platform: Platform.OS,
    pushToken: token.data
  };
}
