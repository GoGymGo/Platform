// @ts-check

const workoutCompletionGraceMs = 15 * 60 * 1_000;

/**
 * The Contest end is the workout-start cutoff anchor. Workouts already in
 * progress receive 15 minutes to finish before the worker can atomically lock,
 * settle, and publish the audited results.
 *
 * @param {{endsAt: string, status: string}} competition
 * @param {Date} [now]
 */
export function isAutomaticResultsPublicationDue(
  competition,
  now = new Date(),
) {
  const endsAt = new Date(competition.endsAt);
  return (
    competition.status === "active" &&
    !Number.isNaN(endsAt.getTime()) &&
    now.getTime() >= endsAt.getTime() + workoutCompletionGraceMs
  );
}

/**
 * Browser-held draw seeds belonged to the retired two-step operator workflow.
 * Remove only that operator-and-origin-scoped legacy record when the account is
 * restored; the worker is now the sole normal publication owner.
 *
 * @param {Storage} storage
 * @param {string} operatorUserId
 * @param {string} environmentOrigin
 */
export function clearLegacyDrawRecovery(
  storage,
  operatorUserId,
  environmentOrigin,
) {
  storage.removeItem(
    `gogymgo.admin.pending-draw-finalization.v2:${encodeURIComponent(environmentOrigin)}:${encodeURIComponent(operatorUserId)}`,
  );
}
