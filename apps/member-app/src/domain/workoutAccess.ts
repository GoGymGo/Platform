export type WorkoutAccessMode = 'active' | 'upcoming';
export type WorkoutEntryTarget = 'active-session' | 'setup' | 'workout';
export type WorkoutSessionContinuity = 'active-session' | 'checking' | 'inactive';

export function getWorkoutSessionContinuity({
  gymScanSessionActive,
  gymScanSessionReady,
  workoutProgressSessionActive
}: {
  gymScanSessionActive: boolean;
  gymScanSessionReady: boolean;
  workoutProgressSessionActive: boolean;
}): WorkoutSessionContinuity {
  if (workoutProgressSessionActive || gymScanSessionActive) {
    return 'active-session';
  }
  return gymScanSessionReady ? 'inactive' : 'checking';
}

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

export function getWorkoutEntryLabel({
  activeSession,
  setupActionLabel,
  setupRequired,
  workoutUnavailable
}: {
  activeSession: boolean;
  setupActionLabel: string;
  setupRequired: boolean;
  workoutUnavailable: boolean;
}) {
  if (setupRequired) return setupActionLabel;
  if (activeSession) return 'WORKOUT IN PROGRESS';
  return workoutUnavailable
    ? 'VERIFIED WORKOUTS NOT YET OPEN'
    : 'START WORKOUT';
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
