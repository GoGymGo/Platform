import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  toCompetitionReminderDate,
  type CompetitionReminder,
  type CompetitionReminderPermission
} from '@/domain/competitionReminders';

const channelId = 'competition-reminders';
const reminderOwner = 'gogymgo-competition';
let notificationHandlerConfigured = false;

export async function getCompetitionReminderPermission(): Promise<CompetitionReminderPermission> {
  ensureNotificationHandler();
  return normalizePermission(await Notifications.getPermissionsAsync());
}

export async function requestCompetitionReminderPermission(): Promise<CompetitionReminderPermission> {
  ensureNotificationHandler();
  const existing = await Notifications.getPermissionsAsync();
  const current = normalizePermission(existing);
  if (current === 'granted' || current === 'provisional') {
    return current;
  }
  return normalizePermission(await Notifications.requestPermissionsAsync());
}

export async function syncCompetitionReminders(
  reminders: readonly CompetitionReminder[],
  timeZone: string
) {
  ensureNotificationHandler();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: 'Contest reminders'
    });
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.owner === reminderOwner)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier)
      )
  );

  const now = Date.now();
  let scheduledCount = 0;

  for (const reminder of reminders) {
    const triggerDate = toCompetitionReminderDate(reminder, timeZone);

    if (triggerDate.getTime() <= now) {
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        body: reminder.body,
        data: {
          dateKey: reminder.dateKey,
          kind: reminder.kind,
          owner: reminderOwner,
          timeZone
        },
        title: reminder.title
      },
      trigger: {
        channelId,
        date: triggerDate,
        type: Notifications.SchedulableTriggerInputTypes.DATE
      }
    });
    scheduledCount += 1;
  }

  return scheduledCount;
}

function ensureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });
  notificationHandlerConfigured = true;
}

function normalizePermission(
  permission: Notifications.NotificationPermissionsStatus
): CompetitionReminderPermission {
  if (
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'provisional';
  }
  if (permission.granted) return 'granted';
  if (permission.status === Notifications.PermissionStatus.UNDETERMINED) return 'undetermined';
  return 'denied';
}
