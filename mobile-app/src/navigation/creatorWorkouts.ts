import type { Href } from 'expo-router';

type CreatorWorkoutsReturnTarget = {
  href: Href;
  label: string;
};

export function getCreatorWorkoutsReturnTarget(
  source: string | undefined
): CreatorWorkoutsReturnTarget {
  if (source === 'session') {
    return { href: '/session', label: 'BACK TO SESSION' };
  }

  if (source === 'profile') {
    return { href: '/profile', label: 'BACK TO PROFILE' };
  }

  return { href: '/home', label: 'BACK TO HOME' };
}
