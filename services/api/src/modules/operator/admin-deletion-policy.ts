import type {
  CompetitionStatus,
  RewardCatalogStatus,
} from '../../database/database.types';

export function canCancelCompetition(status: CompetitionStatus): boolean {
  return status === 'draft' || status === 'registration' || status === 'active';
}

export function canDeleteCompetition(status: CompetitionStatus): boolean {
  return status === 'draft' || status === 'cancelled' || status === 'settled';
}

export function canDeleteReward(status: RewardCatalogStatus): boolean {
  return status === 'draft' || status === 'archived';
}

export function canDeleteCreatorWorkout(published: boolean): boolean {
  return !published;
}

export function canDeleteGym(active: boolean): boolean {
  return !active;
}

export function canDeleteRegionPolicy(input: {
  competitionEnabled: boolean;
  now: Date;
  validTo: Date | null;
}): boolean {
  return (
    !input.competitionEnabled ||
    (input.validTo !== null && input.validTo <= input.now)
  );
}

export function requiresExclusiveCompetitionSlot(
  proposalGymId: string | null,
): boolean {
  return proposalGymId !== null;
}
