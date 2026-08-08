import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { CompetitionReminder } from '@/domain/competitionReminders';

const channelId = 'competition-reminders';
const reminderOwner = 'gogymgo-competition';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function requestCompetitionReminderPermission() {
  const existing = await Notifications.getPermissionsAsync();

  if (existing.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function syncCompetitionReminders(
  reminders: readonly CompetitionReminder[]
) {
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

  const now = new Date();

  await Promise.all(
    reminders.map(async (reminder) => {
      const triggerDate = toLocalReminderTime(reminder.dateKey);

      if (triggerDate <= now) {
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          body: reminder.body,
          data: {
            dateKey: reminder.dateKey,
            kind: reminder.kind,
            owner: reminderOwner
          },
          title: reminder.title
        },
        trigger: {
          channelId,
          date: triggerDate,
          type: Notifications.SchedulableTriggerInputTypes.DATE
        }
      });
    })
  );
}

function toLocalReminderTime(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 18, 0, 0, 0);
}
