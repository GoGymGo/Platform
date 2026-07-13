import type { CompetitionReminder } from '@/domain/competitionReminders';

export async function requestCompetitionReminderPermission(): Promise<boolean> {
  return false;
}

export async function syncCompetitionReminders(
  _reminders: readonly CompetitionReminder[]
): Promise<void> {
  return Promise.resolve();
}
