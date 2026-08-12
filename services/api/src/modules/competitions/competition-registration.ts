type PublishedCompetitionStatus =
  'active' | 'cancelled' | 'draft' | 'registration' | 'settled' | 'settling';

export type CompetitionRegistrationAvailability =
  'closed' | 'not_open' | 'open';

export function availableRegistrationGoalDays({
  configuredGoalDays,
}: {
  configuredGoalDays: readonly number[];
}): number[] {
  return [...configuredGoalDays];
}

export function competitionRegistrationAvailability({
  endsAt,
  now,
  registrationClosesAt,
  registrationOpensAt,
  status,
}: {
  endsAt: Date;
  now: Date;
  registrationClosesAt: Date;
  registrationOpensAt: Date;
  status: PublishedCompetitionStatus;
}): CompetitionRegistrationAvailability {
  if (!['registration', 'active'].includes(status)) return 'closed';
  if (now < registrationOpensAt) return 'not_open';
  if (now >= registrationClosesAt || now >= endsAt) return 'closed';
  return 'open';
}
