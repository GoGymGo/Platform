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

export type WorkoutSessionCompletion = AuthoritativeWorkoutSession & {
  eligibleForReview: boolean;
  violations: readonly string[];
};

export type CompetitionProgress = {
  categoryScore: number;
  competitionId: string;
  enrolledDateKey: string;
  goalDays: number;
  monthKey: string;
  prizeDrawEntries: number;
  sessions: readonly Pick<
    AuthoritativeWorkoutSession,
    'completedAt' | 'eligibleDate' | 'id' | 'startedAt' | 'status'
  >[];
  updatedAt: string;
  verifiedDateKeys: readonly string[];
  verifiedDays: number;
};
