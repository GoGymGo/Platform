import assert from "node:assert/strict";
import test from "node:test";
import { isContestReadyToPublish } from "../app/contest-launch-flow.js";
import { contestWorkoutCutoffs } from "../app/contest-schedule.js";

test("configures one contest from draft prerequisites to safe publication", () => {
  const now = new Date("2026-08-15T00:00:00.000Z");
  const competition = {
    assignedGymIds: ["gym-1"],
    endsAt: "2026-10-01T07:00:00.000Z",
    id: "competition-1",
    name: "September Challenge",
    regionPolicyId: "region-1",
    registrationOpensAt: "2026-08-01T07:00:00.000Z",
    registrationClosesAt: "2026-09-01T06:00:00.000Z",
    startsAt: "2026-09-01T07:00:00.000Z",
    status: "draft",
  };
  const region = {
    competitionEnabled: true,
    countryCode: "CA",
    id: "region-1",
    subdivisionCode: "BC",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: "2027-01-01T00:00:00.000Z",
  };
  const legalDocuments = [
    "privacy_policy",
    "terms_of_service",
    "official_contest_rules",
  ].map((documentKey) => ({
    documentKey,
    effectiveAt: "2026-08-01T00:00:00.000Z",
    jurisdictionCode: "CA-BC",
    locale: "en",
    ownerApprovedAt: "2026-07-31T00:00:00.000Z",
    status: "effective",
  }));
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
      legalDocuments,
      now,
    ),
    false,
  );
  assert.equal(
    isContestReadyToPublish(
      competition,
      [publishedReward],
      [region],
      [gymWithoutPoster],
      legalDocuments,
      now,
    ),
    false,
  );
  assert.equal(
    isContestReadyToPublish(
      competition,
      [publishedReward],
      [region],
      [gymWithPoster],
      legalDocuments,
      now,
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
      legalDocuments,
      now,
    ),
    false,
  );
});
