import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseSetupCompetition,
  getContestLaunchState,
  getContestSetupLocks,
  getNextContestSetupSection,
} from "../app/contest-launch-flow.js";

const region = {
  competitionEnabled: true,
  id: "region-1",
  validFrom: "2026-01-01T00:00:00.000Z",
  validTo: "2027-01-01T00:00:00.000Z",
};
const gym = {
  active: true,
  activeCredentialVersion: 4,
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

test("keeps same-region, same-gym contests independently ready", () => {
  const first = competition("one");
  const second = competition("two");
  const rewards = [publishedReward("one"), publishedReward("two")];

  const firstState = getContestLaunchState(first, rewards, [region], [gym]);
  const secondState = getContestLaunchState(second, rewards, [region], [gym]);

  assert.equal(firstState.readyToPublish, true);
  assert.equal(secondState.readyToPublish, true);
  assert.deepEqual(firstState.assignedGyms.map(({ id }) => id), ["gym-1"]);
  assert.deepEqual(secondState.assignedGyms.map(({ id }) => id), ["gym-1"]);
});

test("explains a cancelled contest instead of silently advancing it", () => {
  const cancelled = competition("cancelled", "cancelled");
  const state = getContestLaunchState(
    cancelled,
    [publishedReward(cancelled.id)],
    [region],
    [gym],
  );
  const locks = getContestSetupLocks(state, true);

  assert.match(state.blockedReason, /cancelled/i);
  assert.equal(state.completedSteps, 0);
  assert.match(locks.rewards, /cancelled/i);
  assert.match(locks.pilot, /cancelled/i);
  assert.equal(getNextContestSetupSection(state), "competitions");
});

test("unlocks each setup section only after its prerequisite", () => {
  const draft = competition("draft");
  const noReward = getContestLaunchState(draft, [], [region], [gym]);
  assert.equal(getContestSetupLocks(noReward, true).rewards, "");
  assert.match(getContestSetupLocks(noReward, true).regions, /reward/i);
  assert.match(getContestSetupLocks(noReward, true).pilot, /reward/i);
  assert.equal(getNextContestSetupSection(noReward), "rewards");

  const noQrGym = { ...gym, activeCredentialVersion: null };
  const noQr = getContestLaunchState(
    draft,
    [publishedReward(draft.id)],
    [region],
    [noQrGym],
  );
  assert.equal(getContestSetupLocks(noQr, true).pilot, "");
  assert.equal(noQr.gymAssigned, true);
  assert.equal(noQr.qrReady, false);
  assert.equal(getNextContestSetupSection(noQr), "pilot");
});

test("prefers the explicitly selected contest without deduplicating by region", () => {
  const contests = [competition("one", "registration"), competition("two")];
  assert.equal(chooseSetupCompetition(contests, "one")?.id, "one");
  assert.equal(chooseSetupCompetition(contests, "")?.id, "two");
});
