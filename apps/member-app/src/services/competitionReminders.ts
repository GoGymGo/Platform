import type {
  CompetitionReminder,
  CompetitionReminderPermission
} from '@/domain/competitionReminders';

export async function getCompetitionReminderPermission(): Promise<CompetitionReminderPermission> {
  return 'unavailable';
}

export async function requestCompetitionReminderPermission(): Promise<CompetitionReminderPermission> {
  return 'unavailable';
}

export async function syncCompetitionReminders(
  _reminders: readonly CompetitionReminder[],
  _timeZone: string
): Promise<number> {
  return 0;
}
