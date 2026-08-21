export const competitionConfig = {
  activeWorkoutStorageKey: '@gogymgo/active-workout-session',
  reminderPreferenceStorageKey: '@gogymgo/competition-reminders-enabled',
  pushInstallationIdStorageKey: '@gogymgo/push-installation-id',
  pushDeviceIdStorageKey: '@gogymgo/push-device-id',
  registrationCompetitionMonthStorageKey: '@gogymgo/competition-registration-month',
  registrationDateStorageKey: '@gogymgo/competition-registration-date',
  workoutLogsStorageKey: '@gogymgo/workout-logs',
  weeklyGoalStorageKey: '@gogymgo/weekly-goal'
} as const;

export const categoryPodiumMultipliers = {
  1: 3,
  2: 2,
  3: 1.5
} as const;

type CategoryPodiumMultiplierRules = {
  categoryPodiumMultipliers?: Partial<Record<1 | 2 | 3, number>>;
} | null;

export function resolveCategoryPodiumMultipliers(
  rules?: CategoryPodiumMultiplierRules
): Record<1 | 2 | 3, number> {
  const first = rules?.categoryPodiumMultipliers?.[1];
  const second = rules?.categoryPodiumMultipliers?.[2];
  const third = rules?.categoryPodiumMultipliers?.[3];

  if (
    ![first, second, third].every(Number.isFinite) ||
    first == null ||
    second == null ||
    third == null ||
    first <= second ||
    second <= third ||
    third <= 1
  ) {
    return categoryPodiumMultipliers;
  }

  return { 1: first, 2: second, 3: third };
}
