import { createUserStorage } from '@/services/storage/userStorage';

const storageKey = '@gogymgo/winners-circle-seen';

export async function getLastSeenWinnersCircle(
  userId: string
) {
  return createUserStorage(userId).getItem(storageKey);
}

export async function markWinnersCircleSeen(
  userId: string,
  presentationKey: string
) {
  await createUserStorage(userId).setItem(storageKey, presentationKey);
}
