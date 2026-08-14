// @ts-check

/** @typedef {import("./admin-types").Competition} Competition */
/** @typedef {import("./admin-types").GymLocation} GymLocation */
/** @typedef {import("./admin-types").LegalDocument} LegalDocument */
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
 * @param {LegalDocument[]} legalDocuments
 * @param {Date} [now]
 */
export function isContestReadyToPublish(
  competition,
  rewards,
  regions,
  gyms,
  legalDocuments,
  now = new Date(),
) {
  if (!competition || competition.status !== "draft") return false;

  const nowTime = now.getTime();
  const scheduleReady =
    new Date(competition.registrationOpensAt).getTime() <= nowTime &&
    new Date(competition.registrationClosesAt).getTime() > nowTime &&
    new Date(competition.startsAt).getTime() > nowTime &&
    new Date(competition.endsAt).getTime() > nowTime;

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
    (gym) => (competition.assignedGymIds ?? []).includes(gym.id) && gym.active,
  );
  const qrReady = assignedGyms.some((gym) =>
    (gym.activeQrCredentials ?? []).some(
      (credential) => credential.competitionId === competition.id,
    ),
  );

  return (
    scheduleReady &&
    rewardReady &&
    regionReady &&
    assignedGyms.length > 0 &&
    qrReady &&
    hasPublishableLegalDocuments(region, legalDocuments, now)
  );
}

/**
 * @param {RegionPolicy | undefined} region
 * @param {LegalDocument[]} legalDocuments
 * @param {Date} [now]
 */
export function hasPublishableLegalDocuments(
  region,
  legalDocuments,
  now = new Date(),
) {
  if (!region) return false;
  const jurisdictionHierarchy = new Set([
    `${region.countryCode}-${region.subdivisionCode}`.toUpperCase(),
    region.countryCode.toUpperCase(),
    "GLOBAL",
  ]);
  const currentKeys = new Set(
    legalDocuments
      .filter(
        (document) =>
          jurisdictionHierarchy.has(document.jurisdictionCode.toUpperCase()) &&
          document.locale.toLowerCase() === "en" &&
          document.status === "effective" &&
          document.ownerApprovedAt !== null &&
          new Date(document.effectiveAt).getTime() <= now.getTime(),
      )
      .map((document) => document.documentKey),
  );
  return ["privacy_policy", "terms_of_service", "official_contest_rules"].every(
    (key) => currentKeys.has(key),
  );
}

/** @param {Competition["status"]} status */
export function canCancelContest(status) {
  return ["draft", "registration", "active"].includes(status);
}

/** @param {Competition["status"]} status */
export function canDeleteContestFromDashboard(status) {
  return ["draft", "cancelled", "settled"].includes(status);
}
