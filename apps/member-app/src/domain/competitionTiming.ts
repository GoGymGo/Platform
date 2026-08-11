const competitionCompletionGraceMilliseconds = 15 * 60 * 1_000;

export function getWorkoutCompletionDeadline(competitionEndsAt: string | Date) {
  const endsAt = new Date(competitionEndsAt);
  return new Date(endsAt.getTime() + competitionCompletionGraceMilliseconds);
}
