import {
  getCompetitionMonthKey,
  getCompetitionRegionDateKey
} from '@/domain/competition';
import { createUserStorage } from '@/services/storage/userStorage';

const storageKey = '@gogymgo/winners-circle-seen';

export async function markWinnersCircleSeen(
  userId: string,
  timeZone: string,
  now = new Date()
) {
  const regionalDateKey = getCompetitionRegionDateKey(
    now,
    timeZone
  );

  await createUserStorage(userId).setItem(
    storageKey,
    getCompetitionMonthKey(regionalDateKey)
  );
}
