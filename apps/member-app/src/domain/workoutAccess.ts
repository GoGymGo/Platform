export type WorkoutAccessMode = 'active' | 'upcoming';
export type WorkoutEntryTarget = 'active-session' | 'setup' | 'workout';

export function getWorkoutEntryTarget({
  activeSession,
  registrationReady
}: {
  activeSession: boolean;
  registrationReady: boolean;
}): WorkoutEntryTarget {
  if (activeSession) return 'active-session';
  return registrationReady ? 'workout' : 'setup';
}

export function getWorkoutAccessMode(
  competitionNotStarted: boolean
): WorkoutAccessMode {
  return competitionNotStarted ? 'upcoming' : 'active';
}

export function resolveSessionCompetitionMonthKey({
  currentMonthKey
}: {
  currentMonthKey: string;
}) {
  return currentMonthKey;
}

export function hasSessionCompetitionAccess({
  competitionId,
  enrollmentCompetitionId
}: {
  competitionId: string;
  enrollmentCompetitionId: string | null;
}) {
  return enrollmentCompetitionId === competitionId;
}
