import type { CreatorWorkout } from '@/domain/creatorWorkouts';

export type CreatorWorkoutPreview = CreatorWorkout;

export const creatorWorkoutPreviews: readonly CreatorWorkoutPreview[] = [
  {
    id: 'toronto-creator-workout',
    creatorName: 'APEX ATHLETICS',
    durationMinutes: 30,
    name: 'FEATURED REGIONAL WORKOUT',
    reward: '30 MIN HIIT // ENTRIES COME FROM VERIFIED SESSIONS',
    timing: 'FEATURED WORKOUT',
    joined: true,
    regionCodes: ['victoria-bc'],
    sponsorName: 'PACIFIC MOTION',
    thumbnailUrl: null,
    videoUrl: 'https://www.youtube.com/watch?v=preview-workout',
    workoutStyle: 'HIIT'
  },
  {
    id: 'july-creator-submissions',
    creatorName: 'CREATOR COMMUNITY',
    durationMinutes: 30,
    name: 'JULY CREATOR SUBMISSIONS',
    reward: 'LOCAL VIDEOS UNDER REVIEW',
    timing: 'SUBMISSION WINDOW ANNOUNCED SOON',
    joined: false,
    regionCodes: ['victoria-bc'],
    sponsorName: null,
    thumbnailUrl: null,
    videoUrl: 'https://gogymgo.com/creators',
    workoutStyle: 'MIXED'
  },
  {
    id: 'next-month-strength-slot',
    creatorName: 'CREATOR COMMUNITY',
    durationMinutes: 40,
    name: 'NEXT MONTH STRENGTH SLOT',
    reward: 'SELECTED CREATOR EARNS SPONSOR POOL',
    timing: 'NEXT MONTH',
    joined: false,
    regionCodes: ['victoria-bc'],
    sponsorName: null,
    thumbnailUrl: null,
    videoUrl: 'https://gogymgo.com/creators',
    workoutStyle: 'STRENGTH'
  }
] as const;
