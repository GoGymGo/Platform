export type CreatorWorkoutPreview = {
  id: string;
  joined: boolean;
  name: string;
  reward: string;
  timing: string;
};

export const creatorWorkoutPreviews: readonly CreatorWorkoutPreview[] = [
  {
    id: 'toronto-creator-workout',
    name: 'FEATURED REGIONAL WORKOUT',
    reward: '30 MIN HIIT // ENTRIES COME FROM VERIFIED SESSIONS',
    timing: 'FEATURED WORKOUT',
    joined: true
  },
  {
    id: 'july-creator-submissions',
    name: 'JULY CREATOR SUBMISSIONS',
    reward: 'LOCAL VIDEOS UNDER REVIEW',
    timing: 'SUBMISSION WINDOW ANNOUNCED SOON',
    joined: false
  },
  {
    id: 'next-month-strength-slot',
    name: 'NEXT MONTH STRENGTH SLOT',
    reward: 'SELECTED CREATOR EARNS SPONSOR POOL',
    timing: 'NEXT MONTH',
    joined: false
  }
] as const;
