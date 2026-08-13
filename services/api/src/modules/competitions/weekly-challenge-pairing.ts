export interface WeeklyChallengePairingEntrant {
  goalDays: number;
  userId: string;
}

export interface WeeklyChallengePair {
  goalDays: number;
  userAId: string;
  userBId: string | null;
}

export interface WeeklyChallengeSearchingMatch {
  id: string;
  userId: string;
}

export interface WeeklyChallengePairingPlan {
  create: WeeklyChallengePair[];
  deleteMatchIds: string[];
  matchWaitingUsers: Array<{
    matchId: string;
    userAId: string;
    userBId: string;
  }>;
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

export function buildAutomaticWeeklyChallengePairingPlan(
  entrants: readonly WeeklyChallengePairingEntrant[],
  waitingMatches: readonly WeeklyChallengeSearchingMatch[],
  assignedUserIds: ReadonlySet<string> = new Set(),
): WeeklyChallengePairingPlan {
  const availableEntrants = entrants.filter(
    (entrant) => !assignedUserIds.has(entrant.userId),
  );
  const availableUserIds = new Set(
    availableEntrants.map((entrant) => entrant.userId),
  );
  const waitingMatchByUserId = new Map<string, WeeklyChallengeSearchingMatch>();
  const deleteMatchIds: string[] = [];

  for (const waitingMatch of [...waitingMatches].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (
      !availableUserIds.has(waitingMatch.userId) ||
      waitingMatchByUserId.has(waitingMatch.userId)
    ) {
      deleteMatchIds.push(waitingMatch.id);
      continue;
    }
    waitingMatchByUserId.set(waitingMatch.userId, waitingMatch);
  }

  const create: WeeklyChallengePair[] = [];
  const matchWaitingUsers: WeeklyChallengePairingPlan['matchWaitingUsers'] = [];
  for (const pair of buildAutomaticWeeklyChallengePairs(availableEntrants)) {
    const userAWaitingMatch = waitingMatchByUserId.get(pair.userAId);
    if (!pair.userBId) {
      if (!userAWaitingMatch) {
        create.push(pair);
      }
      continue;
    }

    const userBWaitingMatch = waitingMatchByUserId.get(pair.userBId);
    const retainedWaitingMatch = userAWaitingMatch ?? userBWaitingMatch;
    if (!retainedWaitingMatch) {
      create.push(pair);
      continue;
    }

    const retainedUserId = userAWaitingMatch ? pair.userAId : pair.userBId;
    const partnerUserId =
      retainedUserId === pair.userAId ? pair.userBId : pair.userAId;
    matchWaitingUsers.push({
      matchId: retainedWaitingMatch.id,
      userAId: retainedUserId,
      userBId: partnerUserId,
    });
    if (userAWaitingMatch && userBWaitingMatch) {
      deleteMatchIds.push(userBWaitingMatch.id);
    }
  }

  return { create, deleteMatchIds, matchWaitingUsers };
}
