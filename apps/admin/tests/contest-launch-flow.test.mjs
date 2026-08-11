import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTestContestSchedule,
  chooseSetupCompetition,
  getContestLaunchState,
  getContestSetupLocks,
  getNextContestSetupSection,
} from "../app/contest-launch-flow.js";

test("builds a same-day 30-minute contest test window", () => {
  const schedule = buildTestContestSchedule(
    new Date("2026-08-10T16:00:30.000Z"),
  );

  assert.equal(schedule.monthKey, "2026-08");
  assert.equal(schedule.registrationOpensAt, "2026-08-10T16:00:30.000Z");
  assert.equal(schedule.registrationClosesAt, "2026-08-10T16:15:00.000Z");
  assert.equal(schedule.startsAt, "2026-08-10T16:15:00.000Z");
  assert.equal(schedule.endsAt, "2026-08-10T16:45:00.000Z");
});

const region = {
  competitionEnabled: true,
  id: "region-1",
  validFrom: "2026-01-01T00:00:00.000Z",
  validTo: "2027-01-01T00:00:00.000Z",
};
const gym = {
  active: true,
  activeCredentialVersion: 4,
  activeQrCredentials: [
    { competitionId: "one", credentialVersion: 3 },
    { competitionId: "two", credentialVersion: 4 },
  ],
  id: "gym-1",
};

function competition(id, status = "draft") {
  return {
    assignedGymIds: ["gym-1"],
    endsAt: "2026-10-01T07:00:00.000Z",
    id,
    name: `Contest ${id}`,
    regionPolicyId: "region-1",
    registrationOpensAt: "2026-08-01T07:00:00.000Z",
    status,
  };
}

function publishedReward(competitionId) {
  return { competitionId, status: "published" };
}

test("requires a separate poster for same-region, same-gym contests", () => {
  const first = competition("one");
  const second = competition("two");
  const rewards = [publishedReward("one"), publishedReward("two")];
  const firstPosterOnly = {
    ...gym,
    activeQrCredentials: [gym.activeQrCredentials[0]],
  };

  const firstState = getContestLaunchState(
    first,
    rewards,
    [region],
    [firstPosterOnly],
  );
  const blockedSecond = getContestLaunchState(
    second,
    rewards,
    [region],
    [firstPosterOnly],
  );
  const secondState = getContestLaunchState(second, rewards, [region], [gym]);

  assert.equal(firstState.readyToPublish, true);
  assert.equal(blockedSecond.qrReady, false);
  assert.equal(blockedSecond.readyToPublish, false);
  assert.equal(secondState.readyToPublish, true);
  assert.deepEqual(
    firstState.assignedGyms.map(({ id }) => id),
    ["gym-1"],
  );
  assert.deepEqual(
    secondState.assignedGyms.map(({ id }) => id),
    ["gym-1"],
  );
});

test("explains a cancelled contest instead of silently advancing it", () => {
  const cancelled = competition("cancelled", "cancelled");
  const state = getContestLaunchState(
    cancelled,
    [publishedReward(cancelled.id)],
    [region],
    [gym],
  );
  const locks = getContestSetupLocks(state);

  assert.match(state.blockedReason, /cancelled/i);
  assert.equal(state.completedSteps, 0);
  assert.match(locks.rewards, /cancelled/i);
  assert.match(locks.pilot, /cancelled/i);
  assert.equal(getNextContestSetupSection(state), "competitions");
});

test("unlocks each setup section only after its prerequisite", () => {
  const draft = competition("draft");
  const noReward = getContestLaunchState(draft, [], [region], [gym]);
  assert.equal(getContestSetupLocks(noReward).rewards, "");
  assert.match(getContestSetupLocks(noReward).regions, /reward/i);
  assert.match(getContestSetupLocks(noReward).pilot, /reward/i);
  assert.equal(getNextContestSetupSection(noReward), "rewards");

  const noQrGym = {
    ...gym,
    activeCredentialVersion: null,
    activeQrCredentials: [],
  };
  const noQr = getContestLaunchState(
    draft,
    [publishedReward(draft.id)],
    [region],
    [noQrGym],
  );
  assert.equal(getContestSetupLocks(noQr).pilot, "");
  assert.equal(noQr.gymAssigned, true);
  assert.equal(noQr.qrReady, false);
  assert.equal(getNextContestSetupSection(noQr), "pilot");
});

test("keeps published contests out of the new-contest setup wizard", () => {
  const contests = [competition("one", "registration"), competition("two")];
  assert.equal(chooseSetupCompetition(contests, "one")?.id, "two");
  assert.equal(chooseSetupCompetition(contests, "")?.id, "two");
  assert.equal(
    chooseSetupCompetition([competition("one", "registration")], "one"),
    null,
  );
});
