// @ts-check

/** @typedef {import("./admin-types").Competition} Competition */
/** @typedef {import("./admin-types").GymLocation} GymLocation */
/** @typedef {import("./admin-types").RegionPolicy} RegionPolicy */
/** @typedef {import("./admin-types").Reward} Reward */

export const contestSetupSections = [
  "competitions",
  "rewards",
  "regions",
  "pilot",
];

export const testContestDurationMinutes = 30;

/**
 * Builds a short, valid contest schedule for staging verification.
 * @param {Date} [referenceDate]
 */
export function buildTestContestSchedule(referenceDate = new Date()) {
  const registrationOpensAt = new Date(referenceDate);
  const startsAt = new Date(referenceDate.getTime() + 15 * 60 * 1_000);
  startsAt.setSeconds(0, 0);
  const endsAt = new Date(
    startsAt.getTime() + testContestDurationMinutes * 60 * 1_000,
  );

  return {
    endsAt: endsAt.toISOString(),
    monthKey: startsAt.toISOString().slice(0, 7),
    registrationClosesAt: startsAt.toISOString(),
    registrationOpensAt: registrationOpensAt.toISOString(),
    startsAt: startsAt.toISOString(),
  };
}

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
export function getContestLaunchState(competition, rewards, regions, gyms) {
  const operational = Boolean(competition && competition.status === "draft");
  const rewardReady = Boolean(
    competition &&
    rewards.some(
      (reward) =>
        reward.competitionId === competition.id &&
        reward.status === "published",
    ),
  );
  const region = competition
    ? regions.find((candidate) => candidate.id === competition.regionPolicyId)
    : undefined;
  const regionReady = Boolean(
    competition &&
    region?.competitionEnabled &&
    new Date(region.validFrom).getTime() <=
      new Date(competition.registrationOpensAt).getTime() &&
    (region.validTo === null ||
      new Date(region.validTo).getTime() >=
        new Date(competition.endsAt).getTime()),
  );
  const assignedGyms = competition
    ? gyms.filter(
        (gym) =>
          (competition.assignedGymIds ?? []).includes(gym.id) && gym.active,
      )
    : [];
  const gymAssigned = assignedGyms.length > 0;
  const qrReady = assignedGyms.some((gym) =>
    (gym.activeQrCredentials ?? []).some(
      (credential) => credential.competitionId === competition?.id,
    ),
  );
  const published = Boolean(
    competition && ["registration", "active"].includes(competition.status),
  );
  const readyToPublish = Boolean(
    competition &&
    competition.status === "draft" &&
    rewardReady &&
    regionReady &&
    gymAssigned &&
    qrReady,
  );
  const blockedReason = !competition
    ? ""
    : competition.status === "cancelled"
      ? `${competition.name} is cancelled and cannot receive a gym or QR poster. Delete it or create a new contest draft.`
      : ["settling", "settled"].includes(competition.status)
        ? `${competition.name} is finished and cannot be configured again.`
        : "";
  const completedSteps = !operational
    ? 0
    : !rewardReady
      ? 1
      : !regionReady
        ? 2
        : !gymAssigned || !qrReady
          ? 3
          : published
            ? 5
            : 4;

  return {
    assignedGyms,
    blockedReason,
    completedSteps,
    gymAssigned,
    operational,
    published,
    qrReady,
    readyToPublish,
    region,
    regionReady,
    rewardReady,
  };
}

/**
 * @param {ReturnType<typeof getContestLaunchState>} state
 */
export function getContestSetupLocks(state) {
  const contestReason = state.blockedReason || "Create a contest draft first.";
  const rewardReason = state.operational ? "" : contestReason;
  const regionReason = !state.operational
    ? contestReason
    : !state.rewardReady
      ? "Publish a reward for the selected contest before confirming its region."
      : "";
  const pilotReason = !state.operational
    ? contestReason
    : !state.rewardReady
      ? "Publish a reward for the selected contest before setting up its gym and QR poster."
      : !state.regionReady
        ? "Confirm an enabled region policy that covers the full contest schedule first."
        : "";

  return {
    pilot: pilotReason,
    regions: regionReason,
    rewards: rewardReason,
  };
}

/**
 * @param {ReturnType<typeof getContestLaunchState>} state
 */
export function getNextContestSetupSection(state) {
  if (!state.operational) return "competitions";
  if (!state.rewardReady) return "rewards";
  if (!state.regionReady) return "regions";
  if (!state.gymAssigned || !state.qrReady) return "pilot";
  return "competitions";
}
