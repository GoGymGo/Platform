export type CreatorWorkout = {
  creatorName: string;
  durationMinutes: number;
  id: string;
  name: string;
  regionCodes: readonly string[];
  reward: string;
  sponsorName: string | null;
  thumbnailUrl: string | null;
  timing: string;
  videoUrl: string;
  workoutStyle: string;
};

export type CreatorWorkoutPlan = {
  creatorName: string;
  durationMinutes: number;
  id: string;
  note: string | null;
  plannedDate: string;
  workoutId: string;
  workoutName: string;
  workoutStyle: string;
};

export type CreateCreatorVideoSubmissionInput = {
  durationMinutes: number;
  notes?: string;
  regionCode: string;
  rightsAccepted: true;
  sponsorDisclosure?: string;
  syntheticMediaDisclosed: boolean;
  thumbnailUrl?: string;
  title: string;
  videoUrl: string;
  workoutStyle: string;
};

export type CreatorVideoSubmission = {
  createdAt: string;
  id: string;
  rightsAcceptedAt: string;
  rightsVersion: string;
  status: 'approved' | 'in_review' | 'rejected' | 'submitted' | 'withdrawn';
  title: string;
  videoUrl: string;
};
