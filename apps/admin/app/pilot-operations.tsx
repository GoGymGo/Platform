"use client";

import type {
  AssignCompetitionGymDto,
  CashFulfillmentRequestDto,
  CreateGymLocationDto,
  OperatorReasonDto,
  UpdateRegionWaitlistStatusDto,
  UpdateGymLocationDto,
} from "@gogymgo/contracts";
import {
  FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { parseCoordinate } from "./coordinate-input";
import { AdminUserFacingError, errorMessage } from "./admin-dashboard-utils";
import { formValidationError } from "./form-validation";
import { posterSvgToJpegBlob } from "./poster-jpeg";
import {
  genericAdministrativeReasons,
  ReasonPresetChips,
} from "./reason-presets";
import type {
  Competition,
  GymLocation,
  GymQrCredential,
  GymSession,
  InterestSubmission,
  PartnerApplication,
  PilotAuditEvent,
  RegionPolicy,
  RegionWaitlistEntry,
} from "./admin-types";

export type PilotData = {
  auditEvents: PilotAuditEvent[];
  gyms: GymLocation[];
  interestSubmissions: InterestSubmission[];
  partnerApplications: PartnerApplication[];
  sessions: GymSession[];
  waitlist: RegionWaitlistEntry[];
};

type PilotOperationsProps = PilotData & {
  onAssignGym: (
    competitionId: string,
    gymId: string,
    input: AssignCompetitionGymDto,
  ) => Promise<void>;
  onCreateGym: (input: CreateGymLocationDto) => Promise<void>;
  onDeleteGym: (gym: GymLocation) => void;
  onIssueQr: (
    competitionId: string,
    gymId: string,
    input: OperatorReasonDto,
  ) => Promise<GymQrCredential>;
  onLoadActiveQr: (
    competitionId: string,
    gymId: string,
  ) => Promise<GymQrCredential | null>;
  onRecordCash: (input: CashFulfillmentRequestDto) => Promise<void>;
  onRevokeQr: (
    competitionId: string,
    gymId: string,
    input: OperatorReasonDto,
  ) => Promise<void>;
  onUpdateGym: (gymId: string, input: UpdateGymLocationDto) => Promise<void>;
  onUpdateWaitlist: (
    entryId: string,
    input: UpdateRegionWaitlistStatusDto,
  ) => Promise<void>;
  regions: RegionPolicy[];
  selectedCompetition: Competition;
  submitting: boolean;
};

const administrativeReason = "Configure the approved contest gym and QR setup.";
const pilotAuditHiddenStorageKey = "gogymgo.admin.pilot.audit-hidden";

export function assertGymQrCredentialScope(
  credential: GymQrCredential,
  competitionId: string,
  gymId: string,
): GymQrCredential {
  if (
    credential.competitionId !== competitionId ||
    credential.gymLocationId !== gymId
  ) {
    throw new AdminUserFacingError(
      "The loaded poster did not match the selected contest and gym. Do not print it. Refresh the dashboard and try again.",
    );
  }
  return credential;
}

function PilotReasonField({
  defaultValue = administrativeReason,
  label = "ADMINISTRATIVE REASON",
}: {
  defaultValue?: string;
  label?: string;
}) {
  const [reason, setReason] = useState(defaultValue);
  return (
    <div className="pilot-form-wide pilot-reason-field">
      <span>{label}</span>
      <ReasonPresetChips
        onSelect={setReason}
        presets={[defaultValue, ...genericAdministrativeReasons]}
        selected={reason}
      />
      <input
        aria-label={label.toLowerCase()}
        minLength={8}
        name="reason"
        onChange={(event) => setReason(event.target.value)}
        required
        value={reason}
      />
    </div>
  );
}

export function PilotOperationsPanel(props: PilotOperationsProps) {
  const { gyms, onLoadActiveQr } = props;
  const selectedCompetitionAssignedGymIds = useMemo(
    () => props.selectedCompetition.assignedGymIds ?? [],
    [props.selectedCompetition.assignedGymIds],
  );
  const selectedRegionGyms = gyms.filter(
    (gym) => gym.regionPolicyId === props.selectedCompetition.regionPolicyId,
  );
  const assignedGymIds = new Set(selectedCompetitionAssignedGymIds);
  const activeAssignedGyms = selectedRegionGyms.filter(
    (gym) => gym.active && assignedGymIds.has(gym.id),
  );
  const availableAssignmentGyms = selectedRegionGyms.filter(
    (gym) => gym.active && !assignedGymIds.has(gym.id),
  );
  const assignmentComplete =
    activeAssignedGyms.length > 0 && availableAssignmentGyms.length === 0;
  const createGymForm = useRef<HTMLFormElement>(null);
  const [poster, setPoster] = useState<GymQrCredential | null>(null);
  const [posterRecoveryMessage, setPosterRecoveryMessage] = useState("");
  const [loadingPosterGymId, setLoadingPosterGymId] = useState<string | null>(
    null,
  );
  const [createGymError, setCreateGymError] = useState("");
  const [createGymSuccess, setCreateGymSuccess] = useState("");
  const [locatingGym, setLocatingGym] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [assignGymError, setAssignGymError] = useState("");
  const [assignGymSuccess, setAssignGymSuccess] = useState("");
  const [cashFormError, setCashFormError] = useState("");
  const [createGymOpen, setCreateGymOpen] = useState(props.gyms.length === 0);
  const [pilotAuditHidden, setPilotAuditHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(pilotAuditHiddenStorageKey) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let active = true;
    const gymsWithActivePosters = gyms.filter(
      (gym) =>
        selectedCompetitionAssignedGymIds.includes(gym.id) &&
        gym.active &&
        (gym.activeQrCredentials ?? []).some(
          (credential) =>
            credential.competitionId === props.selectedCompetition.id,
        ),
    );
    if (gymsWithActivePosters.length === 0) {
      queueMicrotask(() => {
        if (!active) return;
        setPoster(null);
        setPosterRecoveryMessage("");
      });
      return () => {
        active = false;
      };
    }

    void Promise.all(
      gymsWithActivePosters.map(async (gym) => {
        try {
          const credential = await onLoadActiveQr(
            props.selectedCompetition.id,
            gym.id,
          );
          return {
            credential: credential
              ? assertGymQrCredentialScope(
                  credential,
                  props.selectedCompetition.id,
                  gym.id,
                )
              : null,
            failed: false,
          };
        } catch {
          return { credential: null, failed: true };
        }
      }),
    ).then((results) => {
      if (!active) return;
      const recovered = results
        .map((result) => result.credential)
        .filter((credential): credential is GymQrCredential =>
          Boolean(credential),
        )
        .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))[0];
      setPoster(recovered ?? null);
      setPosterRecoveryMessage(
        recovered
          ? ""
          : results.some((result) => result.failed)
            ? "The active poster could not be restored. Refresh the dashboard and try again."
            : "This poster could not be loaded. Reissue it to create a new downloadable copy.",
      );
    });

    return () => {
      active = false;
    };
  }, [
    gyms,
    onLoadActiveQr,
    props.selectedCompetition.id,
    selectedCompetitionAssignedGymIds,
  ]);

  async function viewActivePoster(gym: GymLocation) {
    setLoadingPosterGymId(gym.id);
    setPosterRecoveryMessage("");
    try {
      const loadedCredential = await onLoadActiveQr(
        props.selectedCompetition.id,
        gym.id,
      );
      const credential = loadedCredential
        ? assertGymQrCredentialScope(
            loadedCredential,
            props.selectedCompetition.id,
            gym.id,
          )
        : null;
      if (!credential) {
        setPosterRecoveryMessage(
          "This poster could not be loaded. Reissue it to create a new downloadable copy.",
        );
        return;
      }
      setPoster(credential);
    } catch (error) {
      setPosterRecoveryMessage(errorMessage(error));
    } finally {
      setLoadingPosterGymId(null);
    }
  }

  async function issueQrForGym(gym: GymLocation, input: OperatorReasonDto) {
    setPosterRecoveryMessage("");
    const issuedCredential = await props.onIssueQr(
      props.selectedCompetition.id,
      gym.id,
      input,
    );
    const credential = assertGymQrCredentialScope(
      issuedCredential,
      props.selectedCompetition.id,
      gym.id,
    );
    setPoster(credential);
  }

  function changePilotAuditVisibility(hidden: boolean) {
    setPilotAuditHidden(hidden);
    try {
      if (hidden) {
        window.localStorage.setItem(pilotAuditHiddenStorageKey, "true");
      } else {
        window.localStorage.removeItem(pilotAuditHiddenStorageKey);
      }
    } catch {
      // The visibility choice still applies until this view is closed.
    }
  }

  async function createGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    const regionPolicyId = String(form.get("regionPolicyId") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    const radiusMeters = Number(form.get("radiusMeters"));

    setCreateGymError("");
    setCreateGymSuccess("");

    const validationError = formValidationError(formElement);
    if (validationError) {
      setCreateGymError(validationError);
      return;
    }

    try {
      if (name.length < 2)
        throw new AdminUserFacingError("Partner gym name is required.");
      if (
        props.gyms.some(
          (gym) => gym.name.trim().toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new AdminUserFacingError(
          `${name} already exists. Select it in the assignment form below.`,
        );
      }
      if (!regionPolicyId)
        throw new AdminUserFacingError("Choose the Partner gym's region.");
      if (
        !Number.isInteger(radiusMeters) ||
        radiusMeters < 10 ||
        radiusMeters > 500
      ) {
        throw new AdminUserFacingError(
          "Radius must be a whole number from 10 to 500 metres.",
        );
      }
      if (reason.length < 8) {
        throw new AdminUserFacingError(
          "Administrative reason must be at least 8 characters.",
        );
      }

      await props.onCreateGym({
        address,
        latitude: parseCoordinate(
          String(form.get("latitude") ?? ""),
          "latitude",
        ),
        longitude: parseCoordinate(
          String(form.get("longitude") ?? ""),
          "longitude",
        ),
        name,
        radiusMeters,
        reason,
        regionPolicyId,
      });
      formElement.reset();
      setCreateGymSuccess(
        `${name} was created and is now available in the assignment form below.`,
      );
    } catch (error) {
      setCreateGymError(formErrorMessage(error));
    }
  }

  function useCurrentLocation() {
    setCreateGymError("");
    setCreateGymSuccess("");
    setLocationMessage("");

    if (!isMobileLocationBrowser()) {
      setCreateGymError(
        "Automatic location is available only on a phone. Open this dashboard on your phone or enter the coordinates manually.",
      );
      return;
    }

    if (!navigator.geolocation) {
      setCreateGymError(
        "This phone browser cannot provide your location. Open the dashboard in Safari or Chrome and try again.",
      );
      return;
    }

    setLocatingGym(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const form = createGymForm.current;
        const latitude = form?.elements.namedItem("latitude");
        const longitude = form?.elements.namedItem("longitude");
        if (
          !(latitude instanceof HTMLInputElement) ||
          !(longitude instanceof HTMLInputElement)
        ) {
          setCreateGymError(
            "The location fields could not be filled. Reload and try again.",
          );
          setLocatingGym(false);
          return;
        }

        latitude.value = position.coords.latitude.toFixed(6);
        longitude.value = position.coords.longitude.toFixed(6);
        setLocationMessage(
          `Location added automatically (accurate to about ${Math.round(position.coords.accuracy)} metres).`,
        );
        setLocatingGym(false);
      },
      (error) => {
        setCreateGymError(locationErrorMessage(error));
        setLocatingGym(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  }

  async function assignGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const competitionId = props.selectedCompetition.id;
    const gymId = String(form.get("gymId") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    setAssignGymError("");
    setAssignGymSuccess("");

    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setAssignGymError(validationError);
      return;
    }

    try {
      if (!gymId)
        throw new AdminUserFacingError("Choose an active Partner gym.");
      if (reason.length < 8) {
        throw new AdminUserFacingError(
          "Administrative reason must be at least 8 characters.",
        );
      }
      await props.onAssignGym(competitionId, gymId, { reason });
      const gymName = props.gyms.find((gym) => gym.id === gymId)?.name ?? "Gym";
      setAssignGymSuccess(
        `${gymName} is assigned to ${props.selectedCompetition.name}. Continue below to issue its QR poster.`,
      );
    } catch (error) {
      setAssignGymError(formErrorMessage(error));
    }
  }

  async function recordCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCashFormError("");
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setCashFormError(validationError);
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await props.onRecordCash({
        amountCents: Number(form.get("amountCents")),
        currency: String(form.get("currency") ?? "CAD").toUpperCase(),
        reason: String(form.get("reason") ?? "").trim(),
        rewardAwardId: String(form.get("rewardAwardId") ?? "").trim(),
      });
      event.currentTarget.reset();
    } catch (error) {
      setCashFormError(formErrorMessage(error));
    }
  }

  return (
    <div className="section-stack">
      <section className="panel contest-gym-assignment">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CONTEST GYM ASSIGNMENT</p>
            <h2>
              {assignmentComplete
                ? `Gym assignment complete for ${props.selectedCompetition.name}`
                : activeAssignedGyms.length > 0
                  ? `Assign another gym to ${props.selectedCompetition.name}`
                  : `Assign a gym to ${props.selectedCompetition.name}`}
            </h2>
            <p>
              {assignmentComplete
                ? "Continue directly to this contest's QR poster."
                : "Choose the Partner gym players will select with this contest's initial QR."}
            </p>
          </div>
          <span className="setup-context-tag">
            {props.selectedCompetition.regionName}
          </span>
        </div>
        {assignmentComplete ? (
          <div className="pilot-assignment-complete">
            <p className="pilot-form-message form-success" role="status">
              {activeAssignedGyms.map((gym) => gym.name).join(", ")}{" "}
              {activeAssignedGyms.length === 1 ? "is" : "are"} assigned to{" "}
              {props.selectedCompetition.name}. This contest can now receive its
              own QR poster without changing any other contest at this gym.
            </p>
            <a
              className="primary-button"
              href={`#contest-gym-qr-${activeAssignedGyms[0].id}`}
            >
              CONTINUE TO {props.selectedCompetition.name.toUpperCase()} QR
              POSTER ↓
            </a>
          </div>
        ) : availableAssignmentGyms.length > 0 ? (
          <form className="pilot-form" noValidate onSubmit={assignGym}>
            <label>
              <span>SELECTED CONTEST</span>
              <input
                aria-readonly="true"
                readOnly
                value={`${props.selectedCompetition.name} (${props.selectedCompetition.status})`}
              />
            </label>
            <label>
              <span>PARTNER GYM IN THIS REGION</span>
              <select name="gymId" required>
                <option value="">Choose Partner gym</option>
                {availableAssignmentGyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
              </select>
            </label>
            <PilotReasonField />
            <button
              className="primary-button"
              disabled={props.submitting}
              type="submit"
            >
              {props.submitting
                ? "ASSIGNING GYM..."
                : activeAssignedGyms.length > 0
                  ? "ASSIGN ANOTHER GYM"
                  : "ASSIGN GYM + CONTINUE"}
            </button>
            {activeAssignedGyms.length > 0 ? (
              <p className="pilot-form-message form-success">
                {activeAssignedGyms.map((gym) => gym.name).join(", ")}{" "}
                {activeAssignedGyms.length === 1 ? "is" : "are"} already
                assigned to this contest.
              </p>
            ) : null}
            {assignGymSuccess ? (
              <p aria-live="polite" className="pilot-form-message form-success">
                {assignGymSuccess}
              </p>
            ) : null}
            {assignGymError ? (
              <p className="pilot-form-message form-error" role="alert">
                {assignGymError}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="pilot-form-message form-error" role="status">
            No active Partner gym is available in this region. Create a gym
            below before continuing.
          </p>
        )}
      </section>

      <section className="panel" id="contest-qr-posters">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">STATIC QR PILOT</p>
            <h2>QR posters for {props.selectedCompetition.name}</h2>
            <p>Issue or recover the printable QR poster for an assigned gym.</p>
          </div>
        </div>
        <details
          className="pilot-action-disclosure"
          onToggle={(event) => setCreateGymOpen(event.currentTarget.open)}
          open={createGymOpen}
        >
          <summary>+ CREATE A NEW PARTNER GYM</summary>
          <form
            className="pilot-form"
            noValidate
            onSubmit={createGym}
            ref={createGymForm}
          >
            <label>
              <span>PARTNER GYM NAME</span>
              <input name="name" required />
            </label>
            <label>
              <span>ADDRESS (OPTIONAL DISPLAY INFORMATION)</span>
              <input name="address" />
            </label>
            <label>
              <span>REGION</span>
              <select
                defaultValue={props.selectedCompetition.regionPolicyId}
                name="regionPolicyId"
                required
              >
                {props.regions
                  .filter(
                    (region) =>
                      region.id === props.selectedCompetition.regionPolicyId,
                  )
                  .map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.metroName}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>LATITUDE</span>
              <input
                aria-describedby="gym-coordinate-help"
                inputMode="decimal"
                name="latitude"
                placeholder={"48.123456 or 48\u00b0 7\u2032 24\u2033 N"}
                required
                type="text"
              />
            </label>
            <label>
              <span>LONGITUDE</span>
              <input
                aria-describedby="gym-coordinate-help"
                inputMode="decimal"
                name="longitude"
                placeholder={"-123.123456 or 123\u00b0 7\u2032 24\u2033 W"}
                required
                type="text"
              />
            </label>
            <label>
              <span>RADIUS (METRES)</span>
              <input
                defaultValue="75"
                max="500"
                min="10"
                name="radiusMeters"
                required
                type="number"
              />
            </label>
            <PilotReasonField />
            <p className="pilot-form-help" id="gym-coordinate-help">
              Stand near the centre of the Partner gym. Your current location
              fills the coordinates used to create its verification geofence.
              You can still paste Compass coordinates if needed.
            </p>
            <button
              className="secondary-button pilot-location-button"
              disabled={props.submitting || locatingGym}
              onClick={useCurrentLocation}
              type="button"
            >
              {locatingGym ? "FINDING LOCATION..." : "USE MY PHONE LOCATION"}
            </button>
            {locationMessage ? (
              <p
                aria-live="polite"
                className="pilot-form-message location-success"
              >
                {locationMessage}
              </p>
            ) : null}
            <button
              className="primary-button"
              disabled={props.submitting}
              type="submit"
            >
              {props.submitting
                ? "CREATING PARTNER GYM..."
                : "+ CREATE PARTNER GYM"}
            </button>
            {createGymSuccess ? (
              <p aria-live="polite" className="pilot-form-message form-success">
                {createGymSuccess}
              </p>
            ) : null}
            {createGymError ? (
              <p className="pilot-form-message form-error" role="alert">
                {createGymError}
              </p>
            ) : null}
          </form>
        </details>

        {selectedRegionGyms.length === 0 ? (
          <p className="empty-copy">
            No Partner gym has been configured for this contest region.
          </p>
        ) : (
          <div className="card-list pilot-gym-list">
            {selectedRegionGyms.map((gym) => (
              <GymCard
                activeCredentialVersion={
                  (gym.activeQrCredentials ?? []).find(
                    (credential) =>
                      credential.competitionId === props.selectedCompetition.id,
                  )?.credentialVersion ?? null
                }
                gym={gym}
                key={gym.id}
                onIssue={(input) => issueQrForGym(gym, input)}
                onDelete={() => props.onDeleteGym(gym)}
                onRevoke={async (input) => {
                  await props.onRevokeQr(
                    props.selectedCompetition.id,
                    gym.id,
                    input,
                  );
                  setPosterRecoveryMessage("");
                  setPoster((current) =>
                    current?.gymLocationId === gym.id ? null : current,
                  );
                }}
                onUpdate={(input) => props.onUpdateGym(gym.id, input)}
                onViewPoster={() => void viewActivePoster(gym)}
                posterLoading={loadingPosterGymId === gym.id}
                qrLocked={!assignedGymIds.has(gym.id)}
                selectedContestName={props.selectedCompetition.name}
                submitting={props.submitting}
              />
            ))}
          </div>
        )}

        {posterRecoveryMessage ? (
          <p className="pilot-form-message form-error" role="status">
            {posterRecoveryMessage}
          </p>
        ) : null}
        {poster ? <PosterPreview credential={poster} key={poster.id} /> : null}
      </section>

      <PilotTable
        defaultOpen
        empty="No location-verified gym visits have been recorded."
        eyebrow="LOCATION CHECKS"
        headings={["Gym", "Started", "Completed", "Status"]}
        rows={props.sessions.map((session) => [
          session.gymName,
          formatDateTime(session.startedAt),
          session.completedAt
            ? formatDateTime(session.completedAt)
            : "Missing finish location check",
          session.incomplete ? "incomplete" : session.status,
        ])}
        title="Sessions + incomplete visits"
      />

      <div className="pilot-two-column">
        <PilotTable
          empty="No unsupported-region requests."
          eyebrow="REGIONAL DEMAND"
          headings={[
            "Email",
            "Requested region",
            "Consent",
            "Status",
            "Submitted",
            "Review",
          ]}
          rows={props.waitlist.map((entry) => [
            entry.email,
            entry.requestedRegion,
            entry.consentedAt && entry.consentNoticeVersion
              ? "recorded"
              : "legacy / not recorded",
            entry.status,
            formatDateTime(entry.createdAt),
            <WaitlistReviewControl
              entry={entry}
              key={entry.id}
              onUpdate={props.onUpdateWaitlist}
              submitting={props.submitting}
            />,
          ])}
          title="Region waitlist"
        />
        <PilotTable
          empty="No landing submissions."
          eyebrow="LANDING INTAKE"
          headings={["Contact", "Audience", "Region", "Submitted"]}
          rows={props.interestSubmissions.map((entry) => [
            `${entry.fullName} · ${entry.email}`,
            entry.audience,
            entry.region,
            formatDateTime(entry.submittedAt),
          ])}
          title="Waitlist + interest"
        />
      </div>

      <PilotTable
        empty="No partner applications."
        eyebrow="PARTNERSHIP INTAKE"
        headings={["Type", "Contact", "Region", "Status", "Submitted"]}
        rows={props.partnerApplications.map((entry) => [
          entry.applicationType,
          entry.contactEmail ?? "Not supplied",
          entry.region,
          entry.status,
          formatDateTime(entry.submittedAt),
        ])}
        title="Partner submissions"
      />

      <section className="panel pilot-collapsible-panel pilot-action-panel">
        <details>
          <summary className="pilot-collapsible-summary">
            <div>
              <p className="eyebrow">IN-PERSON CASH HANDOFF</p>
              <h2>Record fulfillment</h2>
              <p>
                The draw must already be settled. This action is permanent and
                audited.
              </p>
            </div>
          </summary>
          <div className="pilot-collapsible-body">
            <form className="pilot-form" noValidate onSubmit={recordCash}>
              <label className="pilot-form-wide">
                <span>AWARD ID</span>
                <input
                  name="rewardAwardId"
                  placeholder="Award ID from the settled draw"
                  required
                />
              </label>
              <label>
                <span>AMOUNT (CENTS)</span>
                <input
                  defaultValue="10000"
                  min="1"
                  name="amountCents"
                  required
                  type="number"
                />
              </label>
              <label>
                <span>CURRENCY</span>
                <input
                  defaultValue="CAD"
                  maxLength={3}
                  minLength={3}
                  name="currency"
                  required
                />
              </label>
              <label className="pilot-form-wide">
                <span>FULFILLMENT NOTE + REASON</span>
                <input
                  minLength={8}
                  name="reason"
                  placeholder="Cash handed to winner in person by …"
                  required
                />
              </label>
              <button
                className="danger-button"
                disabled={props.submitting}
                type="submit"
              >
                RECORD CASH HANDOFF
              </button>
              {cashFormError ? (
                <p className="pilot-form-message form-error" role="alert">
                  {cashFormError}
                </p>
              ) : null}
            </form>
          </div>
        </details>
      </section>

      {pilotAuditHidden ? (
        <section className="panel pilot-dismissed-panel">
          <div>
            <p className="eyebrow">PILOT AUDIT HISTORY</p>
            <h2>Pilot audit history cleared from view</h2>
            <p>
              The audit records remain saved. This display choice affects only
              this device.
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => changePilotAuditVisibility(false)}
            type="button"
          >
            RESTORE AUDIT HISTORY
          </button>
        </section>
      ) : (
        <PilotTable
          dismissLabel="CLEAR FROM VIEW"
          empty="No pilot audit events."
          eyebrow="PILOT AUDIT HISTORY"
          headings={["Action", "Entity", "Reason", "Time"]}
          onDismiss={() => changePilotAuditVisibility(true)}
          rows={props.auditEvents.map((entry) => [
            entry.action,
            `${entry.entityType} · ${entry.entityId}`,
            entry.reason,
            formatDateTime(entry.createdAt),
          ])}
          title="Pilot audit history"
        />
      )}
    </div>
  );
}

function WaitlistReviewControl({
  entry,
  onUpdate,
  submitting,
}: {
  entry: RegionWaitlistEntry;
  onUpdate: PilotOperationsProps["onUpdateWaitlist"];
  submitting: boolean;
}) {
  const transitions: Record<string, UpdateRegionWaitlistStatusDto["status"][]> =
    {
      contacted: ["launched", "closed"],
      launched: ["closed"],
      waiting: ["contacted", "closed"],
    };
  const choices = transitions[entry.status] ?? [];
  const [status, setStatus] = useState<UpdateRegionWaitlistStatusDto["status"]>(
    choices[0] ?? "closed",
  );
  const [reason, setReason] = useState(
    "Record the regional update review outcome.",
  );
  const [error, setError] = useState("");

  if (choices.length === 0) {
    return <span className="table-action-note">No further transition</span>;
  }

  return (
    <form
      className="table-inline-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const validationError = formValidationError(event.currentTarget);
        if (validationError) {
          setError(validationError);
          return;
        }
        setError("");
        void onUpdate(entry.id, { reason, status });
      }}
    >
      <select
        aria-label={`Next status for ${entry.requestedRegion}`}
        onChange={(event) =>
          setStatus(
            event.target.value as UpdateRegionWaitlistStatusDto["status"],
          )
        }
        value={status}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
      <input
        aria-label={`Reason for ${entry.requestedRegion} status`}
        maxLength={500}
        minLength={8}
        onChange={(event) => setReason(event.target.value)}
        required
        value={reason}
      />
      <button disabled={submitting} type="submit">
        UPDATE
      </button>
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}

function formErrorMessage(error: unknown) {
  return errorMessage(error);
}

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access was not allowed. Allow location access in your browser or device settings, then try again.";
  }
  if (error.code === error.TIMEOUT) {
    return "Your device could not get a location in time. Move near a window or outdoors briefly, then try again.";
  }
  return "Your device could not determine its location. Check that device location services and browser site permission are enabled, then try again.";
}

function isMobileLocationBrowser() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod|IEMobile|Mobile|Opera Mini/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
  );
}

function GymCard({
  activeCredentialVersion,
  gym,
  onDelete,
  onIssue,
  onRevoke,
  onUpdate,
  onViewPoster,
  posterLoading,
  qrLocked,
  selectedContestName,
  submitting,
}: {
  activeCredentialVersion: number | null;
  gym: GymLocation;
  onDelete: () => void;
  onIssue: (input: OperatorReasonDto) => Promise<void>;
  onRevoke: (input: OperatorReasonDto) => Promise<void>;
  onUpdate: (input: UpdateGymLocationDto) => Promise<void>;
  onViewPoster: () => void;
  posterLoading: boolean;
  qrLocked: boolean;
  selectedContestName: string;
  submitting: boolean;
}) {
  const qrLockId = useId();
  const [formError, setFormError] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrSuccess, setQrSuccess] = useState("");

  async function issueQr() {
    setQrError("");
    setQrSuccess("");
    try {
      await onIssue({ reason: administrativeReason });
      setQrSuccess(
        `${selectedContestName} poster generated. The printable poster is ready below.`,
      );
    } catch (error) {
      setQrError(formErrorMessage(error));
    }
  }

  async function revokeQr() {
    setQrError("");
    setQrSuccess("");
    try {
      await onRevoke({ reason: "Revoke the current QR poster." });
      setQrSuccess(`${selectedContestName} poster revoked.`);
    } catch (error) {
      setQrError(formErrorMessage(error));
    }
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const validationError = formValidationError(event.currentTarget);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await onUpdate({
        active: form.get("active") === "on",
        address: String(form.get("address") ?? "").trim(),
        latitude: Number(form.get("latitude")),
        longitude: Number(form.get("longitude")),
        name: String(form.get("name") ?? "").trim(),
        radiusMeters: Number(form.get("radiusMeters")),
        reason: String(form.get("reason") ?? "").trim(),
        regionPolicyId: gym.regionPolicyId,
      });
    } catch (error) {
      setFormError(formErrorMessage(error));
    }
  }

  return (
    <article
      className="region-card pilot-gym-card"
      id={`contest-gym-qr-${gym.id}`}
    >
      <div className="region-code">QR</div>
      <div>
        <span className={`status-tag ${gym.active ? "active" : "archived"}`}>
          {gym.active ? "active" : "inactive"}
        </span>
        <span className="setup-context-tag">
          {qrLocked
            ? "ASSIGN TO CONTEST FIRST"
            : `ASSIGNED · ${selectedContestName}`}
        </span>
        <h3>{gym.name}</h3>
        <p>{gym.address || "No display address added"}</p>
        <small>
          {gym.latitude.toFixed(6)}, {gym.longitude.toFixed(6)} ·{" "}
          {gym.radiusMeters} m · {selectedContestName} QR v
          {activeCredentialVersion || "—"}
        </small>
      </div>
      <div className="inline-actions pilot-gym-actions">
        <button
          aria-describedby={qrLocked ? qrLockId : undefined}
          className="primary-button"
          disabled={submitting || qrLocked}
          onClick={() => void issueQr()}
          type="button"
        >
          ISSUE / REISSUE {selectedContestName.toUpperCase()} POSTER
        </button>
        {activeCredentialVersion ? (
          <button
            aria-describedby={qrLocked ? qrLockId : undefined}
            className="secondary-button"
            disabled={submitting || posterLoading || qrLocked}
            onClick={onViewPoster}
            type="button"
          >
            {posterLoading ? "RESTORING POSTER..." : "VIEW ACTIVE POSTER"}
          </button>
        ) : null}
        <button
          className="danger-button"
          disabled={submitting || !activeCredentialVersion}
          onClick={() => void revokeQr()}
          type="button"
        >
          REVOKE QR
        </button>
        {!gym.active ? (
          <button
            className="danger-button"
            disabled={submitting}
            onClick={onDelete}
            type="button"
          >
            DELETE GYM
          </button>
        ) : null}
      </div>
      {qrLocked ? (
        <p className="action-guidance compact" id={qrLockId}>
          Assign {gym.name} to {selectedContestName} above before issuing or
          viewing its QR poster. An existing QR poster can still be revoked.
        </p>
      ) : null}
      {qrSuccess ? (
        <p
          aria-live="polite"
          className="pilot-form-message form-success pilot-qr-action-message"
        >
          {qrSuccess}
        </p>
      ) : null}
      {qrError ? (
        <p
          className="pilot-form-message form-error pilot-qr-action-message"
          role="alert"
        >
          {qrError}
        </p>
      ) : null}
      <details className="pilot-details">
        <summary>Edit Partner gym + geofence</summary>
        <form className="pilot-form" noValidate onSubmit={update}>
          <label>
            <span>NAME</span>
            <input defaultValue={gym.name} name="name" required />
          </label>
          <label>
            <span>ADDRESS (OPTIONAL DISPLAY INFORMATION)</span>
            <input defaultValue={gym.address} name="address" />
          </label>
          <label>
            <span>LATITUDE</span>
            <input
              defaultValue={gym.latitude}
              max="90"
              min="-90"
              name="latitude"
              required
              step="any"
              type="number"
            />
          </label>
          <label>
            <span>LONGITUDE</span>
            <input
              defaultValue={gym.longitude}
              max="180"
              min="-180"
              name="longitude"
              required
              step="any"
              type="number"
            />
          </label>
          <label>
            <span>RADIUS</span>
            <input
              defaultValue={gym.radiusMeters}
              max="500"
              min="10"
              name="radiusMeters"
              required
              type="number"
            />
          </label>
          <label className="check-field">
            <input defaultChecked={gym.active} name="active" type="checkbox" />
            <span>ACTIVE</span>
          </label>
          <PilotReasonField label="REASON" />
          <button
            className="secondary-button"
            disabled={submitting}
            type="submit"
          >
            SAVE PARTNER GYM
          </button>
          {formError ? (
            <p className="pilot-form-message form-error" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      </details>
    </article>
  );
}

export function PosterPreview({ credential }: { credential: GymQrCredential }) {
  const [source, setSource] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const contentId = useId();

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    void posterSvgToJpegBlob(credential.printablePosterSvg)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setSource(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {
        if (active) {
          setConversionError(
            "The poster was issued, but this browser could not prepare its JPEG preview. Try again in a current browser.",
          );
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [credential.printablePosterSvg]);

  return (
    <div className="poster-preview">
      <div className="poster-preview-header">
        <strong>
          {credential.competitionName.toUpperCase()} · PRINTABLE QR POSTER ·
          VERSION {credential.credentialVersion}
        </strong>
        <span>
          ACTIVE UNTIL {new Date(credential.expiresAt).toLocaleString()}
        </span>
        <div className="poster-preview-actions">
          <button
            aria-controls={contentId}
            aria-expanded={!collapsed}
            className="text-button poster-collapse-button"
            onClick={() => setCollapsed((current) => !current)}
            type="button"
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
      <div className="poster-preview-content" hidden={collapsed} id={contentId}>
        {source ? (
          <>
            {/* Generated object URLs cannot use the Sites image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`Printable ${credential.competitionName} QR poster`}
              src={source}
            />
            <a
              className="primary-button"
              download={`${credential.competitionName
                .toLowerCase()
                .replace(
                  /[^a-z0-9]+/g,
                  "-",
                )}-gym-qr-v${credential.credentialVersion}.jpg`}
              href={source}
            >
              DOWNLOAD JPEG FOR PRINTING
            </a>
          </>
        ) : conversionError ? (
          <p className="poster-preview-status error-message" role="alert">
            {conversionError}
          </p>
        ) : (
          <p className="poster-preview-status" role="status">
            PREPARING JPEG PREVIEW...
          </p>
        )}
      </div>
    </div>
  );
}

function PilotTable({
  defaultOpen = false,
  dismissLabel,
  empty,
  eyebrow,
  headings,
  onDismiss,
  rows,
  title,
}: {
  defaultOpen?: boolean;
  dismissLabel?: string;
  empty: string;
  eyebrow: string;
  headings: string[];
  onDismiss?: () => void;
  rows: ReactNode[][];
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel pilot-collapsible-panel">
      <details
        onToggle={(event) => setOpen(event.currentTarget.open)}
        open={open}
      >
        <summary className="pilot-collapsible-summary">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <span className="pilot-panel-count">
            {rows.length} {rows.length === 1 ? "RECORD" : "RECORDS"}
          </span>
        </summary>
        <div className="pilot-collapsible-body">
          {onDismiss ? (
            <div className="pilot-panel-controls">
              <span>Records remain saved in the audit history.</span>
              <button className="text-button" onClick={onDismiss} type="button">
                {dismissLabel ?? "CLEAR FROM VIEW"}
              </button>
            </div>
          ) : null}
          {rows.length === 0 ? (
            <p className="empty-copy">{empty}</p>
          ) : (
            <div
              aria-label={`${title} table, scroll horizontally for more columns`}
              className="table-wrap"
              role="region"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    {headings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={`${title}-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
