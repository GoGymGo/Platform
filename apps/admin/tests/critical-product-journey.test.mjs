import assert from "node:assert/strict";
import test from "node:test";
import { isContestReadyToPublish } from "../app/contest-launch-flow.js";
import { contestWorkoutCutoffs } from "../app/contest-schedule.js";

test("configures one contest from draft prerequisites to safe publication", () => {
  const competition = {
    assignedGymIds: ["gym-1"],
    endsAt: "2026-10-01T07:00:00.000Z",
    id: "competition-1",
    name: "September Challenge",
    regionPolicyId: "region-1",
    registrationOpensAt: "2026-08-01T07:00:00.000Z",
    status: "draft",
  };
  const region = {
    competitionEnabled: true,
    id: "region-1",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
  };
  const draftReward = {
    competitionId: competition.id,
    status: "draft",
  };
  const publishedReward = { ...draftReward, status: "published" };
  const gymWithoutPoster = {
    active: true,
    activeQrCredentials: [],
    id: "gym-1",
  };
  const gymWithPoster = {
    ...gymWithoutPoster,
    activeQrCredentials: [
      {
        competitionId: competition.id,
        credentialVersion: 1,
      },
    ],
  };

  assert.equal(
    isContestReadyToPublish(
      competition,
      [draftReward],
      [region],
      [gymWithoutPoster],
    ),
    false,
  );
  assert.equal(
    isContestReadyToPublish(
      competition,
      [publishedReward],
      [region],
      [gymWithoutPoster],
    ),
    false,
  );
  assert.equal(
    isContestReadyToPublish(
      competition,
      [publishedReward],
      [region],
      [gymWithPoster],
    ),
    true,
  );
  assert.deepEqual(contestWorkoutCutoffs(competition.endsAt), {
    completionDeadline: "2026-10-01T07:15:00.000Z",
    startBefore: "2026-10-01T06:45:00.000Z",
  });
  assert.equal(
    isContestReadyToPublish(
      { ...competition, status: "registration" },
      [publishedReward],
      [region],
      [gymWithPoster],
    ),
    false,
  );
});
