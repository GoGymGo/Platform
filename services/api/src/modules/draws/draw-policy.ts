import { competitionCompletionDeadline } from '../gyms/gym-scan-policy';

export function canLockCompetitionDraw(input: {
  competitionEndsAt: Date;
  competitionStatus: string;
  now: Date;
}): boolean {
  return (
    input.competitionStatus === 'active' &&
    input.now >= competitionCompletionDeadline(input.competitionEndsAt)
  );
}
