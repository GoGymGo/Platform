// @ts-check

/** @typedef {import("./admin-types").Competition} Competition */
/** @typedef {import("./admin-types").GymLocation} GymLocation */
/** @typedef {import("./admin-types").RegionPolicy} RegionPolicy */
/** @typedef {import("./admin-types").Reward} Reward */

/**
 * @param {Competition[]} competitions
 * @param {string} preferredId
 */
export function chooseSetupCompetition(competitions, preferredId) {
  if (preferredId === "new") return null;
  return (
    competitions.find(
      (competition) =>
        competition.id === preferredId && competition.status === "draft",
    ) ??
    competitions.find((competition) => competition.status === "draft") ??
    null
  );
}

/**
 * @param {Competition | null} competition
 * @param {Reward[]} rewards
 * @param {RegionPolicy[]} regions
 * @param {GymLocation[]} gyms
 */
export function isContestReadyToPublish(competition, rewards, regions, gyms) {
  if (!competition || competition.status !== "draft") return false;

  const rewardReady = rewards.some(
    (reward) =>
      reward.competitionId === competition.id && reward.status === "published",
  );
  const region = regions.find(
    (candidate) => candidate.id === competition.regionPolicyId,
  );
  const regionReady = Boolean(
    region?.competitionEnabled &&
    new Date(region.validFrom).getTime() <=
      new Date(competition.registrationOpensAt).getTime() &&
    (region.validTo === null ||
      new Date(region.validTo).getTime() >=
        new Date(competition.endsAt).getTime()),
  );
  const assignedGyms = gyms.filter(
    (gym) =>
      (competition.assignedGymIds ?? []).includes(gym.id) && gym.active,
  );
  const qrReady = assignedGyms.some((gym) =>
    (gym.activeQrCredentials ?? []).some(
      (credential) => credential.competitionId === competition.id,
    ),
  );

  return rewardReady && regionReady && assignedGyms.length > 0 && qrReady;
}

/** @param {Competition["status"]} status */
export function canCancelContest(status) {
  return ["draft", "registration", "active"].includes(status);
}

/** @param {Competition["status"]} status */
export function canDeleteContestFromDashboard(status) {
  return ["draft", "cancelled", "settled"].includes(status);
}
