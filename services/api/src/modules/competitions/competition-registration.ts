type PublishedCompetitionStatus =
  'active' | 'cancelled' | 'draft' | 'registration' | 'settled' | 'settling';

export function availableRegistrationGoalDays({
  configuredGoalDays,
}: {
  configuredGoalDays: readonly number[];
}): number[] {
  return [...configuredGoalDays];
}

export function isPublishedCompetitionJoinable({
  endsAt,
  now,
  status,
}: {
  endsAt: Date;
  now: Date;
  status: PublishedCompetitionStatus;
}): boolean {
  return ['registration', 'active'].includes(status) && now < endsAt;
}
