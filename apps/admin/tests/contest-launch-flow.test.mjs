import assert from "node:assert/strict";
import test from "node:test";
import {
  canCancelContest,
  canDeleteContestFromDashboard,
  chooseSetupCompetition,
  isContestReadyToPublish,
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

  assert.equal(
    isContestReadyToPublish(first, rewards, [region], [firstPosterOnly]),
    true,
  );
  assert.equal(
    isContestReadyToPublish(second, rewards, [region], [firstPosterOnly]),
    false,
  );
  assert.equal(
    isContestReadyToPublish(second, rewards, [region], [gym]),
    true,
  );
});

test("never treats a non-draft contest as publish-ready", () => {
  for (const status of ["registration", "active", "settled", "cancelled"]) {
    const candidate = competition(status, status);
    assert.equal(
      isContestReadyToPublish(
        candidate,
        [publishedReward(candidate.id)],
        [region],
        [gym],
      ),
      false,
    );
  }
});

test("requires every setup prerequisite", () => {
  const draft = competition("draft");
  assert.equal(isContestReadyToPublish(draft, [], [region], [gym]), false);

  const noQrGym = {
    ...gym,
    activeCredentialVersion: null,
    activeQrCredentials: [],
  };
  assert.equal(
    isContestReadyToPublish(
      draft,
      [publishedReward(draft.id)],
      [region],
      [noQrGym],
    ),
    false,
  );

  assert.equal(
    isContestReadyToPublish(
      draft,
      [publishedReward(draft.id)],
      [{ ...region, competitionEnabled: false }],
      [gym],
    ),
    false,
  );
});

test("keeps published contests out of the new-contest setup wizard", () => {
  const contests = [competition("one", "registration"), competition("two")];
  assert.equal(chooseSetupCompetition(contests, "one")?.id, "two");
  assert.equal(chooseSetupCompetition(contests, "")?.id, "two");
  assert.equal(
    chooseSetupCompetition([competition("one", "registration")], "one"),
    null,
  );
  assert.equal(chooseSetupCompetition([competition("two")], "new"), null);
});

test("keeps contest cancellation and dashboard deletion controls available", () => {
  for (const status of ["draft", "registration", "active"]) {
    assert.equal(canCancelContest(status), true);
  }
  for (const status of ["cancelled", "settling", "settled"]) {
    assert.equal(canCancelContest(status), false);
  }

  for (const status of ["draft", "cancelled", "settled"]) {
    assert.equal(canDeleteContestFromDashboard(status), true);
  }
  for (const status of ["registration", "active", "settling"]) {
    assert.equal(canDeleteContestFromDashboard(status), false);
  }
});
