import type { CompetitionReminder } from '@/domain/competitionReminders';

export async function requestCompetitionReminderPermission() {
  return false;
}

export async function syncCompetitionReminders(
  _reminders: readonly CompetitionReminder[]
) {
  return Promise.resolve();
}
