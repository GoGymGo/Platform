"use client";

import { FormEvent, useRef, useState } from "react";
import type {
  Competition,
  GymLocation,
  GymQrCredential,
  LegalDocument,
  RegionPolicy,
  Reward,
} from "./admin-types";
import { hasPublishableLegalDocuments } from "./contest-launch-flow.js";
import {
  AdminUserFacingError,
  compactObject,
  errorMessage,
  optionalNumber,
  optionalString,
} from "./admin-dashboard-utils";
import {
  contestWorkoutCutoffsFromInput,
  defaultCompetitionDatesInZone,
  defaultContestTimeZone,
  formatContestDateTime,
  toZonedDateTimeInput,
  zonedDateTimeToIso,
} from "./contest-schedule.js";

const defaultCompetitionRules = {
  categoryPodiumMultipliers: { 1: 3, 2: 2, 3: 1.5 },
  minHeartRateSamples: 10,
  minSessionMinutes: 30,
  perfectMonthMultiplier: 10,
  requireDeviceAttestation: false,
  requireGymQr: true,
  requirePresenceCheck: false,
  signupPrizeDrawEntries: 1,
  verifiedSessionCategoryScore: 1,
  verifiedSessionPrizeDrawEntries: 1,
  weeklyChallengeBothHitMultiplier: 2,
  weeklyChallengeRecoveryMultiplier: 3,
};

type SetupSection = "contest" | "region" | "review" | "reward";

type ScheduleInputs = {
  endsAt: string;
  registrationClosesAt: string;
  registrationOpensAt: string;
  startsAt: string;
};

export type ContestSetupSubmission = {
  competition?: Competition;
  competitionBody: Record<string, unknown>;
  couponCodes: string[];
  gymId: string | null;
  reward?: Reward;
  rewardBody: Record<string, unknown> | null;
};

type ContestSetupPublishResult = {
  competitionId: string;
  poster: GymQrCredential;
};

type ContestSetupWorkspaceProps = {
  competition: Competition | null;
  competitions: Competition[];
  gyms: GymLocation[];
  legalDocuments: LegalDocument[];
  onCreateGym: () => void;
  onCreateRegion: () => void;
  onPublish: (
    submission: ContestSetupSubmission,
    reportProgress: (message: string) => void,
  ) => Promise<ContestSetupPublishResult>;
  onSelectCompetition: (competitionId: string) => void;
  regions: RegionPolicy[];
  rewards: Reward[];
  submitting: boolean;
};

const sectionLabels: Record<SetupSection, string> = {
  contest: "Contest",
  reward: "Reward",
  region: "Region + gym",
  review: "Review + publish",
};
const minimumContestDurationMs = 30 * 60 * 1_000;

function parseRules(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Rules must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new AdminUserFacingError(
      "Scoring and verification rules cannot be read. Check the advanced contest settings.",
    );
  }
}

function couponCodes(value: FormDataEntryValue | null): string[] {
  return [
    ...new Set(
      String(value ?? "")
        .split(/[\r\n,]+/)
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  ];
}

function optionalZonedIso(
  value: FormDataEntryValue | null,
  timeZone: string,
) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  try {
    return zonedDateTimeToIso(normalized, timeZone);
  } catch (error) {
    throw new AdminUserFacingError(
      error instanceof Error ? error.message : "Enter a valid date and time.",
    );
  }
}

function formattedScheduleInput(value: string, timeZone: string) {
  try {
    return formatContestDateTime(zonedDateTimeToIso(value, timeZone), timeZone);
  } catch {
    return "Not set";
  }
}

function distanceKilometres(
  latitude: number,
  longitude: number,
  gym: GymLocation,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(gym.latitude - latitude);
  const longitudeDelta = radians(gym.longitude - longitude);
  const left = radians(latitude);
  const right = radians(gym.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(left) * Math.cos(right) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function locationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access was not allowed. Choose the contest region below instead.";
  }
  if (error.code === error.TIMEOUT) {
    return "Your location took too long to detect. Try again or choose the region below.";
  }
  return "Your location could not be detected. Choose the contest region below.";
}

function nativeSectionErrors(form: HTMLFormElement) {
  const errors: Partial<Record<SetupSection, string>> = {};
  const invalid: (
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
  )[] = [];
  form
    .querySelectorAll("input:invalid, select:invalid, textarea:invalid")
    .forEach((control) => {
      if (
        (control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement ||
          control instanceof HTMLTextAreaElement) &&
        !control.disabled
      ) {
        invalid.push(control);
      }
    });

  form.querySelectorAll("[aria-invalid='true']").forEach((control) =>
    control.removeAttribute("aria-invalid"),
  );
  invalid.forEach((control) => {
    control.setAttribute("aria-invalid", "true");
    const section =
      (control
        .closest("[data-setup-section]")
        ?.getAttribute("data-setup-section") as SetupSection | null) ??
      "contest";
    errors[section] ??= `Complete the highlighted ${sectionLabels[section].toLowerCase()} fields.`;
  });
  return { errors, firstInvalid: invalid[0] };
}

function SetupField({
  children,
  label,
  wide,
}: {
  children: React.ReactNode;
  label: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function SectionError({ message }: { message?: string }) {
  return message ? (
    <p className="setup-section-error" role="alert">
      <span aria-hidden="true">!</span>
      {message}
    </p>
  ) : null;
}

function statusForStep(
  section: SetupSection,
  competition: Competition | null,
  publishedReward: Reward | undefined,
  selectedRegion: RegionPolicy | undefined,
  selectedGym: GymLocation | undefined,
) {
  if (section === "contest") return competition ? "SAVED" : "FILL IN";
  if (section === "reward") return publishedReward ? "READY" : "FILL IN";
  if (section === "region") {
    return selectedRegion && selectedGym ? "SELECTED" : "CHOOSE";
  }
  return "FINAL";
}

export function ContestSetupWorkspace({
  competition,
  competitions,
  gyms,
  legalDocuments,
  onCreateGym,
  onCreateRegion,
  onPublish,
  onSelectCompetition,
  regions,
  rewards,
  submitting,
}: ContestSetupWorkspaceProps) {
  const contestRewards = rewards.filter(
    (reward) => reward.competitionId === competition?.id,
  );
  const publishedReward = contestRewards.find(
    (reward) => reward.status === "published",
  );
  const editableReward = publishedReward
    ? undefined
    : contestRewards.find((reward) => reward.status === "draft");
  const enabledRegions = regions.filter((region) => region.competitionEnabled);
  const initialRegionId =
    competition?.regionPolicyId ??
    (enabledRegions.length === 1 ? enabledRegions[0]?.id : undefined) ??
    "";
  const initialTimeZone =
    enabledRegions.find((region) => region.id === initialRegionId)?.timezone ??
    defaultContestTimeZone;
  const [dates] = useState(() =>
    defaultCompetitionDatesInZone(initialTimeZone),
  );
  const initialAssignedGym = gyms.find(
    (gym) =>
      gym.active &&
      competition?.assignedGymIds.includes(gym.id) &&
      gym.regionPolicyId === initialRegionId,
  );
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId);
  const [selectedGymId, setSelectedGymId] = useState(
    initialAssignedGym?.id ?? "",
  );
  const [rewardType, setRewardType] = useState<Reward["rewardType"]>(
    editableReward?.rewardType ?? "physical",
  );
  const [contestName, setContestName] = useState(competition?.name ?? "");
  const [rewardTitle, setRewardTitle] = useState(
    publishedReward?.title ?? editableReward?.title ?? "",
  );
  const [schedule, setSchedule] = useState<ScheduleInputs>(() => ({
    endsAt: toZonedDateTimeInput(
      competition?.endsAt ?? dates.endsAt,
      initialTimeZone,
    ),
    registrationClosesAt: toZonedDateTimeInput(
      competition?.registrationClosesAt ?? dates.startsAt,
      initialTimeZone,
    ),
    registrationOpensAt: toZonedDateTimeInput(
      competition?.registrationOpensAt ?? dates.registrationOpensAt,
      initialTimeZone,
    ),
    startsAt: toZonedDateTimeInput(
      competition?.startsAt ?? dates.startsAt,
      initialTimeZone,
    ),
  }));
  const [sectionErrors, setSectionErrors] = useState<
    Partial<Record<SetupSection, string>>
  >({});
  const [flowError, setFlowError] = useState("");
  const [progress, setProgress] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locationIssue, setLocationIssue] = useState("");
  const [locating, setLocating] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const selectedRegion = enabledRegions.find(
    (region) => region.id === selectedRegionId,
  );
  const selectedTimeZone = selectedRegion?.timezone ?? initialTimeZone;
  const workoutCutoffs = contestWorkoutCutoffsFromInput(
    schedule.endsAt,
    selectedTimeZone,
  );
  const regionGyms = gyms.filter(
    (gym) => gym.active && gym.regionPolicyId === selectedRegionId,
  ).sort((left, right) => left.name.localeCompare(right.name));
  const selectedGym = regionGyms.find((gym) => gym.id === selectedGymId);

  function updateSchedule(field: keyof ScheduleInputs, value: string) {
    setSchedule((current) => ({ ...current, [field]: value }));
  }

  function useMyLocation() {
    setLocationIssue("");
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationIssue(
        "This browser cannot provide your location. Choose the contest region below.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const nearestGym = [...gyms]
          .filter((gym) =>
            gym.active &&
            enabledRegions.some((region) => region.id === gym.regionPolicyId),
          )
          .sort(
            (left, right) =>
              distanceKilometres(latitude, longitude, left) -
              distanceKilometres(latitude, longitude, right),
          )[0];
        const suggestedRegionId =
          nearestGym?.regionPolicyId ??
          (enabledRegions.length === 1 ? enabledRegions[0]?.id : undefined);
        if (suggestedRegionId) {
          setSelectedRegionId(suggestedRegionId);
          setSelectedGymId("");
        }
        const suggestedRegion = enabledRegions.find(
          (region) => region.id === suggestedRegionId,
        );
        setLocationMessage(
          suggestedRegion
            ? `${suggestedRegion.metroName} is suggested from your location. Confirm it below.`
            : "Location detected. Choose the matching enabled region below.",
        );
        setLocating(false);
      },
      (error) => {
        setLocationIssue(locationError(error));
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
    );
  }

  function validate(formElement: HTMLFormElement, formData: FormData) {
    const native = nativeSectionErrors(formElement);
    const errors = { ...native.errors };
    const goalDays = String(formData.get("goalDays") ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
    if (goalDays.length === 0) {
      errors.contest = "Add at least one Weekly Goal from 1 to 7 days.";
    }
    let parsedSchedule: Record<keyof ScheduleInputs, string> | null = null;
    let registrationOpensAt = new Date(Number.NaN);
    let endsAt = new Date(Number.NaN);
    try {
      parsedSchedule = {
        endsAt: zonedDateTimeToIso(
          String(formData.get("endsAt")),
          selectedTimeZone,
        ),
        registrationClosesAt: zonedDateTimeToIso(
          String(formData.get("registrationClosesAt")),
          selectedTimeZone,
        ),
        registrationOpensAt: zonedDateTimeToIso(
          String(formData.get("registrationOpensAt")),
          selectedTimeZone,
        ),
        startsAt: zonedDateTimeToIso(
          String(formData.get("startsAt")),
          selectedTimeZone,
        ),
      };
      registrationOpensAt = new Date(parsedSchedule.registrationOpensAt);
      const registrationClosesAt = new Date(
        parsedSchedule.registrationClosesAt,
      );
      const startsAt = new Date(parsedSchedule.startsAt);
      endsAt = new Date(parsedSchedule.endsAt);
      if (
        registrationOpensAt >= registrationClosesAt ||
        registrationClosesAt > startsAt ||
        startsAt >= endsAt
      ) {
        errors.contest =
          "Use a valid schedule: registration opens, registration closes, contest starts, then contest ends.";
      } else if (
        endsAt.getTime() - startsAt.getTime() <
        minimumContestDurationMs
      ) {
        errors.contest =
          "Allow at least 30 minutes for the required workout. Players who start in time have 15 minutes after the contest ends to finish verification.";
      }
    } catch (error) {
      errors.contest =
        error instanceof Error
          ? error.message
          : "Enter valid schedule times for the selected region.";
    }
    if (!selectedRegion) {
      errors.region = "Detect or choose an enabled contest region.";
    } else if (
      new Date(selectedRegion.validFrom) > registrationOpensAt ||
      (selectedRegion.validTo && new Date(selectedRegion.validTo) < endsAt)
    ) {
      errors.region = `${selectedRegion.metroName} does not cover the full contest schedule. Choose another region or create a replacement policy.`;
    }
    if (
      selectedRegion &&
      !hasPublishableLegalDocuments(selectedRegion, legalDocuments)
    ) {
      errors.region ??=
        "Publish current owner-approved Privacy, Terms and Official Contest Rules for this jurisdiction before launching.";
    }
    if (!publishedReward) {
      const selectedRewardType = String(formData.get("rewardType"));
      const claimUrl = optionalString(formData.get("claimUrl"));
      const fulfillment = optionalString(
        formData.get("fulfillmentInstructions"),
      );
      const imageUrl = optionalString(formData.get("imageUrl"));
      const termsUrl = optionalString(formData.get("termsUrl"));
      if (!imageUrl || !termsUrl) {
        errors.reward =
          "Add an approved HTTPS image and terms link before publishing.";
      } else if (
        selectedRewardType !== "coupon" &&
        Boolean(claimUrl) === Boolean(fulfillment)
      ) {
        errors.reward =
          "Choose exactly one secure claim URL or fulfillment instruction path.";
      } else if (selectedRewardType === "coupon" && (claimUrl || fulfillment)) {
        errors.reward =
          "Coupon rewards cannot include a physical claim URL or instructions.";
      }
      if (selectedRewardType === "coupon") {
        const total = Number(formData.get("inventoryTotal"));
        const supplied = couponCodes(formData.get("couponCodes")).length;
        const existing = editableReward?.couponCodeCount ?? 0;
        if (existing + supplied < total) {
          errors.reward = `Add ${Math.max(total - existing, 0)} unique coupon code${total - existing === 1 ? "" : "s"} so every reward can be fulfilled.`;
        }
      }
    }
    if (!selectedGym) {
      errors.region ??=
        "Choose an approved Partner gym that GoGymGo has added to this region.";
    }
    setSectionErrors(errors);
    const firstSection = (
      ["contest", "reward", "region"] as SetupSection[]
    ).find((section) => errors[section]);
    if (firstSection) {
      document
        .getElementById(`setup-${firstSection}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      native.firstInvalid?.focus({ preventScroll: true });
    }
    return { errors, goalDays, parsedSchedule };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFlowError("");
    setProgress("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { errors, goalDays, parsedSchedule } = validate(formElement, form);
    if (Object.keys(errors).length > 0 || !parsedSchedule) return;

    try {
      const competitionBody = {
        endsAt: parsedSchedule.endsAt,
        entrantCap: optionalNumber(form.get("entrantCap")),
        goalBrackets: [...new Set(goalDays)].map((goal) => ({
          goalDays: goal,
          label: `${goal} DAY${goal === 1 ? "" : "S"} / WEEK`,
        })),
        minimumEntrants: 1,
        monthKey: String(form.get("monthKey")),
        name: String(form.get("name")).trim(),
        reason: competition
          ? "Update and publish the contest through the one-page launch review."
          : "Create and publish the contest through the one-page launch review.",
        regionPolicyId: selectedRegionId,
        registrationClosesAt: parsedSchedule.registrationClosesAt,
        registrationOpensAt: parsedSchedule.registrationOpensAt,
        rules: parseRules(String(form.get("rules"))),
        rulesVersion: String(form.get("rulesVersion")),
        startsAt: parsedSchedule.startsAt,
      };
      const rewardBody = publishedReward
        ? null
        : compactObject({
            availableFrom: optionalZonedIso(
              form.get("availableFrom"),
              selectedTimeZone,
            ),
            availableUntil: optionalZonedIso(
              form.get("availableUntil"),
              selectedTimeZone,
            ),
            claimUrl: optionalString(form.get("claimUrl")),
            description: String(form.get("description")).trim(),
            displayOrder: Number(form.get("displayOrder") || 0),
            fulfillmentInstructions: optionalString(
              form.get("fulfillmentInstructions"),
            ),
            imageUrl: optionalString(form.get("imageUrl")),
            inventoryTotal: Number(form.get("inventoryTotal")),
            reason: editableReward
              ? "Update and publish the verified reward during contest launch."
              : "Create and publish the verified reward during contest launch.",
            rewardType: String(form.get("rewardType")),
            sponsorName: String(form.get("sponsorName")).trim(),
            termsUrl: optionalString(form.get("termsUrl")),
            title: String(form.get("title")).trim(),
          });
      await onPublish(
        {
          competition: competition ?? undefined,
          competitionBody,
          couponCodes:
            rewardType === "coupon" && !publishedReward
              ? couponCodes(form.get("couponCodes"))
              : [],
          gymId: selectedGym?.id ?? null,
          reward: editableReward,
          rewardBody,
        },
        setProgress,
      );
    } catch (error) {
      setFlowError(errorMessage(error));
      setProgress("");
      document
        .getElementById("setup-review")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const steps: SetupSection[] = ["contest", "reward", "region", "review"];

  return (
    <section className="one-page-setup">
      <div className="one-page-setup-intro">
        <div>
          <p className="eyebrow">ONE-PAGE CONTEST SETUP</p>
          <h2>{competition ? `Finish ${competition.name}` : "Create a contest"}</h2>
          <p>
            Fill in each section once. The final button saves everything,
            publishes the reward, creates the QR poster and opens the contest.
          </p>
        </div>
        <label className="setup-contest-switcher">
          <span>CONTEST BEING SET UP</span>
          <select
            onChange={(event) => onSelectCompetition(event.target.value)}
            value={competition?.id ?? "new"}
          >
            <option value="new">+ New contest</option>
            {competitions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} ({candidate.status})
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav aria-label="Contest setup sections" className="setup-anchor-rail">
        {steps.map((step, index) => (
          <a href={`#setup-${step}`} key={step}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{sectionLabels[step]}</span>
            <small>
              {statusForStep(
                step,
                competition,
                publishedReward,
                selectedRegion,
                selectedGym,
              )}
            </small>
          </a>
        ))}
      </nav>

      <form
        className="one-page-setup-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        ref={formRef}
      >
        <section
          className="setup-flow-card"
          data-setup-section="contest"
          id="setup-contest"
        >
          <div className="setup-flow-card-index">
            <span>01</span>
            <small>CONTEST</small>
          </div>
          <div className="setup-flow-card-body">
            <header>
              <div>
                <p className="eyebrow">CONTEST DETAILS</p>
                <h3>What players are joining</h3>
              </div>
              <span className={competition ? "setup-ready-tag" : "setup-draft-tag"}>
                {competition ? "DRAFT LOADED" : "NEW"}
              </span>
            </header>
            <SectionError message={sectionErrors.contest} />
            <div className="form-grid setup-form-grid">
              <SetupField label="CONTEST NAME" wide>
                <input
                  minLength={2}
                  name="name"
                  onChange={(event) => setContestName(event.target.value)}
                  required
                  value={contestName}
                />
              </SetupField>
              <SetupField label="CONTEST MONTH">
                <input
                  defaultValue={competition?.monthKey ?? dates.monthKey}
                  name="monthKey"
                  pattern="\d{4}-\d{2}"
                  required
                />
              </SetupField>
              <SetupField label="WEEKLY GOALS">
                <input
                  defaultValue={
                    competition?.goalBrackets
                      .map((goal) => goal.goalDays)
                      .join(", ") ?? "1, 2, 3, 4, 5, 6, 7"
                  }
                  name="goalDays"
                  required
                />
                <small className="field-help">Separate days with commas.</small>
              </SetupField>
              <SetupField label="REGISTRATION OPENS">
                <input
                  name="registrationOpensAt"
                  onChange={(event) =>
                    updateSchedule("registrationOpensAt", event.target.value)
                  }
                  required
                  type="datetime-local"
                  value={schedule.registrationOpensAt}
                />
              </SetupField>
              <SetupField label="REGISTRATION CLOSES">
                <input
                  name="registrationClosesAt"
                  onChange={(event) =>
                    updateSchedule("registrationClosesAt", event.target.value)
                  }
                  required
                  type="datetime-local"
                  value={schedule.registrationClosesAt}
                />
              </SetupField>
              <SetupField label="CONTEST STARTS">
                <input
                  name="startsAt"
                  onChange={(event) =>
                    updateSchedule("startsAt", event.target.value)
                  }
                  required
                  type="datetime-local"
                  value={schedule.startsAt}
                />
              </SetupField>
              <SetupField label="CONTEST ENDS">
                <input
                  name="endsAt"
                  onChange={(event) =>
                    updateSchedule("endsAt", event.target.value)
                  }
                  required
                  type="datetime-local"
                  value={schedule.endsAt}
                />
                <small className="field-help">
                  {workoutCutoffs ? (
                    <>
                      Workouts must start before {formatContestDateTime(
                        workoutCutoffs.startBefore,
                        selectedTimeZone,
                      )} and in-progress workouts must finish before {formatContestDateTime(
                        workoutCutoffs.completionDeadline,
                        selectedTimeZone,
                      )}.
                    </>
                  ) : (
                    "Enter the contest end time to see the workout cutoffs."
                  )}
                </small>
              </SetupField>
              <p className="setup-time-zone-note">
                Schedule times use <strong>{selectedTimeZone}</strong>, the selected
                region&apos;s timezone.
              </p>
              <SetupField label="ENTRANT CAP (OPTIONAL)">
                <input
                  defaultValue={competition?.entrantCap ?? ""}
                  min={1}
                  name="entrantCap"
                  type="number"
                />
              </SetupField>
              <details className="reward-advanced setup-advanced">
                <summary>
                  <span>ADVANCED CONTEST SETTINGS</span>
                  <small>Rules version and scoring configuration</small>
                </summary>
                <div className="reward-advanced-grid">
                  <SetupField label="RULES VERSION">
                    <input
                      defaultValue={
                        competition?.rulesVersion ?? `${dates.monthKey}-v1`
                      }
                      name="rulesVersion"
                      required
                    />
                  </SetupField>
                  <SetupField label="SCORING + VERIFICATION RULES" wide>
                    <textarea
                      defaultValue={JSON.stringify(
                        competition?.rules ?? defaultCompetitionRules,
                        null,
                        2,
                      )}
                      name="rules"
                      required
                      rows={10}
                    />
                  </SetupField>
                </div>
              </details>
            </div>
          </div>
        </section>

        <section
          className="setup-flow-card"
          data-setup-section="reward"
          id="setup-reward"
        >
          <div className="setup-flow-card-index">
            <span>02</span>
            <small>REWARD</small>
          </div>
          <div className="setup-flow-card-body">
            <header>
              <div>
                <p className="eyebrow">REWARD DETAILS</p>
                <h3>Create it once; publishing is automatic</h3>
              </div>
              <span
                className={publishedReward ? "setup-ready-tag" : "setup-draft-tag"}
              >
                {publishedReward ? "PUBLISHED" : editableReward ? "DRAFT LOADED" : "NEW"}
              </span>
            </header>
            <SectionError message={sectionErrors.reward} />
            {publishedReward ? (
              <div className="setup-existing-record">
                <span className="status-tag published">PUBLISHED</span>
                <div>
                  <strong>{publishedReward.title}</strong>
                  <p>
                    {publishedReward.sponsorName} · {publishedReward.inventoryTotal}{" "}
                    available. It will stay attached to this contest.
                  </p>
                </div>
              </div>
            ) : (
              <div className="form-grid setup-form-grid">
                <SetupField label="BRAND / SPONSOR">
                  <input
                    defaultValue={editableReward?.sponsorName}
                    minLength={2}
                    name="sponsorName"
                    required
                  />
                </SetupField>
                <SetupField label="REWARD TITLE">
                  <input
                    minLength={2}
                    name="title"
                    onChange={(event) => setRewardTitle(event.target.value)}
                    required
                    value={rewardTitle}
                  />
                </SetupField>
                <SetupField label="REWARD TYPE">
                  <select
                    name="rewardType"
                    onChange={(event) =>
                      setRewardType(event.target.value as Reward["rewardType"])
                    }
                    value={rewardType}
                  >
                    <option value="physical">Physical</option>
                    <option value="coupon">Coupon code</option>
                    <option value="cash">Cash</option>
                  </select>
                </SetupField>
                <SetupField label="QUANTITY">
                  <input
                    defaultValue={editableReward?.inventoryTotal ?? 1}
                    max={100000}
                    min={1}
                    name="inventoryTotal"
                    required
                    type="number"
                  />
                </SetupField>
                <SetupField label="DESCRIPTION" wide>
                  <textarea
                    defaultValue={editableReward?.description}
                    minLength={2}
                    name="description"
                    required
                    rows={4}
                  />
                </SetupField>
                {rewardType === "coupon" ? (
                  <SetupField label="COUPON CODES" wide>
                    <textarea
                      aria-describedby="setup-coupon-help"
                      name="couponCodes"
                      placeholder="One unique code per line"
                      rows={6}
                    />
                    <small className="field-help" id="setup-coupon-help">
                      {editableReward?.couponCodeCount
                        ? `${editableReward.couponCodeCount} codes are already saved. Add the remainder here.`
                        : "Add one unique code for every inventory unit. They are uploaded and published in the final action."}
                    </small>
                  </SetupField>
                ) : (
                  <fieldset className="reward-fulfillment setup-reward-fulfillment">
                    <legend>FULFILLMENT</legend>
                    <p>Choose exactly one way for a winner to receive this reward.</p>
                    <div className="reward-fulfillment-fields">
                      <SetupField label="SECURE CLAIM URL">
                        <input
                          defaultValue={editableReward?.claimUrl ?? ""}
                          name="claimUrl"
                          placeholder="https://"
                          type="url"
                        />
                      </SetupField>
                      <SetupField label="FULFILLMENT INSTRUCTIONS">
                        <textarea
                          defaultValue={
                            editableReward?.fulfillmentInstructions ?? ""
                          }
                          name="fulfillmentInstructions"
                          rows={3}
                        />
                      </SetupField>
                    </div>
                  </fieldset>
                )}
                <details className="reward-advanced setup-advanced">
                  <summary>
                    <span>ADVANCED REWARD OPTIONS</span>
                    <small>Image, terms, availability and display order</small>
                  </summary>
                  <div className="reward-advanced-grid">
                    <SetupField label="IMAGE URL">
                      <input
                        defaultValue={editableReward?.imageUrl ?? ""}
                        name="imageUrl"
                        placeholder="https://"
                        type="url"
                      />
                    </SetupField>
                    <SetupField label="TERMS URL">
                      <input
                        defaultValue={editableReward?.termsUrl ?? ""}
                        name="termsUrl"
                        placeholder="https://"
                        type="url"
                      />
                    </SetupField>
                    <SetupField label="DISPLAY ORDER">
                      <input
                        defaultValue={editableReward?.displayOrder ?? 0}
                        min={0}
                        name="displayOrder"
                        type="number"
                      />
                    </SetupField>
                    <SetupField label="AVAILABLE FROM">
                      <input
                        defaultValue={
                          editableReward?.availableFrom
                            ? toZonedDateTimeInput(
                                editableReward.availableFrom,
                                selectedTimeZone,
                              )
                            : ""
                        }
                        name="availableFrom"
                        type="datetime-local"
                      />
                    </SetupField>
                    <SetupField label="AVAILABLE UNTIL">
                      <input
                        defaultValue={
                          editableReward?.availableUntil
                            ? toZonedDateTimeInput(
                                editableReward.availableUntil,
                                selectedTimeZone,
                              )
                            : ""
                        }
                        name="availableUntil"
                        type="datetime-local"
                      />
                    </SetupField>
                  </div>
                </details>
              </div>
            )}
          </div>
        </section>

        <section
          className="setup-flow-card"
          data-setup-section="region"
          id="setup-region"
        >
          <div className="setup-flow-card-index">
            <span>03</span>
            <small>REGION</small>
          </div>
          <div className="setup-flow-card-body">
            <header>
              <div>
                <p className="eyebrow">REGION SELECTION</p>
                <h3>Detect, then confirm the contest region</h3>
              </div>
              {selectedRegion && selectedGym ? (
                <span className="setup-ready-tag">SELECTED</span>
              ) : null}
            </header>
            <SectionError message={sectionErrors.region} />
            <div className="setup-location-row">
              <button
                className="secondary-button setup-location-button"
                disabled={locating || submitting}
                onClick={useMyLocation}
                type="button"
              >
                {locating ? "DETECTING LOCATION..." : "USE MY LOCATION"}
              </button>
              <div>
                <strong>We only use this reading to suggest a region.</strong>
                <span>You always confirm the final choice.</span>
              </div>
            </div>
            {locationMessage ? (
              <p className="setup-location-message success" role="status">
                {locationMessage}
              </p>
            ) : null}
            {locationIssue ? (
              <p className="setup-location-message error" role="status">
                {locationIssue}
              </p>
            ) : null}
            <div className="setup-region-choice">
              <SetupField label="CONTEST REGION" wide>
                <select
                  name="regionPolicyId"
                  onChange={(event) => {
                    setSelectedRegionId(event.target.value);
                    setSelectedGymId("");
                  }}
                  required
                  value={selectedRegionId}
                >
                  <option value="">Choose a region</option>
                  {enabledRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.metroName} · {region.subdivisionCode}
                    </option>
                  ))}
                </select>
              </SetupField>
              {selectedRegion ? (
                <div className="setup-region-summary">
                  <span className="status-dot active" />
                  <div>
                    <strong>{selectedRegion.metroName}</strong>
                    <small>
                      {selectedRegion.countryCode} · {selectedRegion.timezone} ·{" "}
                      age {selectedRegion.minimumAge}+
                    </small>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="setup-assigned-gym-choice">
              <SetupField label="ASSIGNED GYM" wide>
                <select
                  disabled={!selectedRegionId}
                  name="gymId"
                  onChange={(event) => setSelectedGymId(event.target.value)}
                  required
                  value={selectedGymId}
                >
                  <option value="">
                    {!selectedRegionId
                      ? "Choose a region first"
                      : regionGyms.length > 0
                        ? "Choose an approved partner gym"
                        : "No approved partner gyms in this region"}
                  </option>
                  {regionGyms.map((gym) => (
                    <option key={gym.id} value={gym.id}>
                      {gym.name}
                      {competition?.assignedGymIds.includes(gym.id)
                        ? " · already assigned"
                        : ""}
                    </option>
                  ))}
                </select>
                <small className="field-help">
                  Only active partner gyms approved and added by GoGymGo appear
                  here. The contest QR poster is created automatically.
                </small>
              </SetupField>
            </div>
            <button
              className="text-button setup-create-region"
              onClick={onCreateGym}
              type="button"
            >
              + ADD AN APPROVED PARTNER GYM
            </button>
            <button
              className="text-button setup-create-region"
              onClick={onCreateRegion}
              type="button"
            >
              + CREATE A DIFFERENT REGION
            </button>
          </div>
        </section>

        <section
          className="setup-flow-card setup-review-card"
          data-setup-section="review"
          id="setup-review"
        >
          <div className="setup-flow-card-index">
            <span>04</span>
            <small>REVIEW</small>
          </div>
          <div className="setup-flow-card-body">
            <header>
              <div>
                <p className="eyebrow">FINAL REVIEW</p>
                <h3>One action publishes the complete contest</h3>
                <p>
                  If something is missing, its section will be marked in red and
                  nothing will publish until it is corrected.
                </p>
              </div>
            </header>
            <div className="setup-review-grid">
              <div>
                <small>CONTEST</small>
                <strong>{contestName || "Not complete"}</strong>
              </div>
              <div>
                <small>REWARD</small>
                <strong>{publishedReward?.title || rewardTitle || "Not complete"}</strong>
              </div>
              <div>
                <small>REGION</small>
                <strong>{selectedRegion?.metroName || "Not selected"}</strong>
              </div>
              <div>
                <small>GYM + POSTER</small>
                <strong>{selectedGym?.name || "Not selected"}</strong>
              </div>
              <div>
                <small>REGISTRATION</small>
                <strong>
                  {formattedScheduleInput(
                    schedule.registrationOpensAt,
                    selectedTimeZone,
                  )} {" → "}
                  {formattedScheduleInput(
                    schedule.registrationClosesAt,
                    selectedTimeZone,
                  )}
                </strong>
              </div>
              <div>
                <small>CONTEST</small>
                <strong>
                  {formattedScheduleInput(schedule.startsAt, selectedTimeZone)}
                  {" → "}
                  {formattedScheduleInput(schedule.endsAt, selectedTimeZone)}
                </strong>
              </div>
              <div>
                <small>WORKOUTS START</small>
                <strong>
                  {workoutCutoffs
                    ? `BEFORE ${formatContestDateTime(
                        workoutCutoffs.startBefore,
                        selectedTimeZone,
                      )}`
                    : "NOT SET"}
                </strong>
              </div>
              <div>
                <small>IN-PROGRESS WORKOUTS FINISH</small>
                <strong>
                  {workoutCutoffs
                    ? `BEFORE ${formatContestDateTime(
                        workoutCutoffs.completionDeadline,
                        selectedTimeZone,
                      )}`
                    : "NOT SET"}
                </strong>
              </div>
              <div>
                <small>WORKOUT REQUIREMENT</small>
                <strong>AT LEAST 30 MINUTES</strong>
              </div>
            </div>
            {flowError ? (
              <p className="setup-publish-error" role="alert">
                <span>THE CONTEST WAS NOT PUBLISHED</span>
                {flowError}
              </p>
            ) : null}
            {progress ? (
              <p aria-live="polite" className="setup-publish-progress">
                <span aria-hidden="true" />
                {progress}
              </p>
            ) : null}
            <div className="setup-final-action">
              <div>
                <strong>PUBLISHING WILL:</strong>
                <span>
                  save the contest · publish the reward · assign the gym · issue
                  the poster · open the contest home
                </span>
              </div>
              <button
                className="primary-button setup-publish-button"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "PUBLISHING COMPLETE SETUP..." : "PUBLISH CONTEST"}
              </button>
            </div>
          </div>
        </section>
      </form>
    </section>
  );
}
