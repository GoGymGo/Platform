import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const channelId = 'verified-workout-checks';
const reminderOwner = 'gogymgo-mid-session-check';

type MidSessionReminderInput = {
  checkAtSeconds: number;
  sessionId: string;
  startedAt: string;
  timeScale: number;
};

export async function scheduleMidSessionCheckReminder({
  checkAtSeconds,
  sessionId,
  startedAt,
  timeScale
}: MidSessionReminderInput) {
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
      name: 'Verified workout checks',
      sound: 'default',
      vibrationPattern: [0, 250, 200, 250]
    });
  }

  await cancelMidSessionCheckReminder();

  const elapsedRealSeconds = Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000);
  const remainingScaledSeconds = Math.max(1, checkAtSeconds - elapsedRealSeconds * timeScale);
  const triggerDate = new Date(Date.now() + (remainingScaledSeconds / Math.max(1, timeScale)) * 1000);

  await Notifications.scheduleNotificationAsync({
    content: {
      body: 'Open GoGymGo now and complete the presence check before the grace period ends.',
      data: {
        owner: reminderOwner,
        route: '/workout/ping',
        sessionId
      },
      sound: 'default',
      title: 'Workout presence check required'
    },
    trigger: {
      channelId,
      date: triggerDate,
      type: Notifications.SchedulableTriggerInputTypes.DATE
    }
  });

  return true;
}

export async function cancelMidSessionCheckReminder() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.owner === reminderOwner)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier)
      )
  );
}

export async function signalMidSessionCheck() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
