export interface WeeklyChallengePairingEntrant {
  goalDays: number;
  userId: string;
}

export interface WeeklyChallengePair {
  goalDays: number;
  userAId: string;
  userBId: string | null;
}

export function buildAutomaticWeeklyChallengePairs(
  entrants: readonly WeeklyChallengePairingEntrant[],
  assignedUserIds: ReadonlySet<string> = new Set(),
): WeeklyChallengePair[] {
  const entrantsByGoal = new Map<number, WeeklyChallengePairingEntrant[]>();

  for (const entrant of entrants) {
    if (assignedUserIds.has(entrant.userId)) {
      continue;
    }
    const goalEntrants = entrantsByGoal.get(entrant.goalDays) ?? [];
    goalEntrants.push(entrant);
    entrantsByGoal.set(entrant.goalDays, goalEntrants);
  }

  const pairs: WeeklyChallengePair[] = [];
  for (const goalDays of [...entrantsByGoal.keys()].sort(
    (left, right) => left - right,
  )) {
    const goalEntrants = entrantsByGoal
      .get(goalDays)!
      .sort((left, right) => left.userId.localeCompare(right.userId));

    for (let index = 0; index < goalEntrants.length; index += 2) {
      pairs.push({
        goalDays,
        userAId: goalEntrants[index].userId,
        userBId: goalEntrants[index + 1]?.userId ?? null,
      });
    }
  }

  return pairs;
}
