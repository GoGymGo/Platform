export type WorkoutSessionStatus =
  | 'active'
  | 'cancelled'
  | 'pending_review'
  | 'rejected'
  | 'verified';

export type AuthoritativeWorkoutSession = {
  completedAt: string | null;
  competitionId: string;
  eligibleDate: string;
  id: string;
  policyVersion: string;
  startedAt: string;
  status: WorkoutSessionStatus;
};

export type SessionRequirements = {
  minHeartRateSamples: number;
  minSessionMinutes: number;
  requireDeviceAttestation: boolean;
  requireGymQr: boolean;
  requirePresenceCheck: boolean;
};

export type StartedWorkoutSession = AuthoritativeWorkoutSession & {
  requirements: SessionRequirements;
};

export type WorkoutSessionCompletion = AuthoritativeWorkoutSession & {
  eligibleForReview: boolean;
  violations: readonly string[];
};

export type CompetitionProgress = {
  bankedPrizeDrawEntries: number;
  categoryScore: number;
  competitionId: string;
  competitionStatus: 'active' | 'registration' | 'settled' | 'settling';
  enrolledDateKey: string;
  goalDays: number;
  monthKey: string;
  prizeDrawEntries: number;
  projectedPrizeDrawEntries: number;
  referenceDateKey: string;
  rulesVersion: string;
  scoringStatus: 'final' | 'provisional';
  serverTime: string;
  sessions: readonly Pick<
    AuthoritativeWorkoutSession,
    'completedAt' | 'eligibleDate' | 'id' | 'startedAt' | 'status'
  >[];
  updatedAt: string;
  settledPeriodCount: number;
  verifiedDateKeys: readonly string[];
  verifiedDays: number;
};
