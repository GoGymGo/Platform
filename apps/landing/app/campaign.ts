export const septemberCampaign = {
  competitionEndAt: "2026-10-01T07:00:00.000Z",
  competitionStartAt: "2026-09-01T07:00:00.000Z",
  competitionWindow:
    "September 1, 2026 at 12:00 a.m. PDT to October 1, 2026 at 12:00 a.m. PDT",
  compactWindow: "SEP 1 → OCT 1",
  displayWindow: "September 1 → October 1, 2026",
  endDate: "October 1, 2026 at 12:00 a.m. PDT",
  minimumAge: 19,
  minimumSessionMinutes: 30,
  regionName: "Vancouver Island + Gulf Islands",
  registrationLabel: "REGISTRATION OPEN",
  registrationNote:
    "The app confirms current availability. Registration can close when the Contest ends, reaches an entrant cap, or is cancelled.",
  reward: "$100 CAD",
  rewardSponsor: "GoGymGo",
  rewardAvailabilityNote:
    "The member app and published Official Contest Rules are authoritative. The reward is available only after the approved September Contest and reward are published.",
  startDate: "September 1, 2026 at 12:00 a.m. PDT",
  supportedIslands: [
    "Denman Island",
    "Ballenas-Winchelsea",
    "Gabriola Island",
    "Galiano Island",
    "Hornby Island",
    "Lasqueti Island",
    "Mayne Island",
    "North Pender Island",
    "Salt Spring Island",
    "Saturna Island",
    "South Pender Island",
    "Thetis Island",
  ],
  timeWindow: "12:00 a.m. PDT to 12:00 a.m. PDT",
  weeklyGoalRange: "1–7 days",
} as const;

export function isSeptemberPilotPublished(
  value = process.env.NEXT_PUBLIC_SEPTEMBER_PILOT_PUBLISHED,
): boolean {
  return value === "yes";
}

export function getSeptemberCampaignState(
  now = new Date(),
  published = isSeptemberPilotPublished(),
) {
  const currentTime = now.getTime();
  const startTime = Date.parse(septemberCampaign.competitionStartAt);
  const endTime = Date.parse(septemberCampaign.competitionEndAt);

  if (!published) {
    return {
      phase: "unpublished" as const,
      primaryAction: "regionalUpdates" as const,
      primaryLabel: "GET REGIONAL UPDATES",
      statusLabel: "PILOT NOT YET PUBLISHED",
    };
  }

  if (currentTime >= endTime) {
    return {
      phase: "ended" as const,
      primaryAction: "regionalUpdates" as const,
      primaryLabel: "GET REGIONAL UPDATES",
      statusLabel: "CONTEST ENDED",
    };
  }

  if (currentTime >= startTime) {
    return {
      phase: "active" as const,
      primaryAction: "memberApp" as const,
      primaryLabel: "CHECK CURRENT AVAILABILITY",
      statusLabel: "CONTEST ACTIVE",
    };
  }

  return {
    phase: "registration" as const,
    primaryAction: "memberApp" as const,
    primaryLabel: "JOIN SEPTEMBER BETA",
    statusLabel: septemberCampaign.registrationLabel,
  };
}
