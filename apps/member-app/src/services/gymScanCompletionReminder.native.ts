import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { GymScanCompletionReminderInput } from './gymScanCompletionReminder';

const channelId = 'gym-workout-complete';
const reminderOwner = 'gogymgo-gym-scan-complete';

export async function scheduleGymScanCompletionReminder({
  gymName,
  minimumCompleteAt,
  sessionId
}: GymScanCompletionReminderInput) {
  const triggerTime = Date.parse(minimumCompleteAt);
  if (!Number.isFinite(triggerTime) || triggerTime <= Date.now()) {
    return false;
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      importance: Notifications.AndroidImportance.HIGH,
      name: 'Gym workout completion',
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250]
    });
  }

  await cancelGymScanCompletionReminder();
  await Notifications.scheduleNotificationAsync({
    content: {
      body: `Your 30-minute minimum${gymName ? ` at ${gymName}` : ''} is complete. Return to the gym and verify your location to finish.`,
      data: {
        owner: reminderOwner,
        route: '/qr-scanner',
        sessionId
      },
      sound: 'default',
      title: 'Time to finish your workout'
    },
    trigger: {
      channelId,
      date: new Date(triggerTime),
      type: Notifications.SchedulableTriggerInputTypes.DATE
    }
  });

  return true;
}

export async function cancelGymScanCompletionReminder() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.owner === reminderOwner)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier)
      )
  );
}
