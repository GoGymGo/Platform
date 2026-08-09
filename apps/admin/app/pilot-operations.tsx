"use client";

import type {
  AssignCompetitionGymDto,
  CashFulfillmentRequestDto,
  CreateGymLocationDto,
  OperatorReasonDto,
  UpdateGymLocationDto,
} from "@gogymgo/contracts";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { parseCoordinate } from "./coordinate-input";
import { AdminUserFacingError, errorMessage } from "./admin-dashboard-utils";
import { posterSvgToJpegBlob } from "./poster-jpeg";
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
  competitions: Competition[];
  onAssignGym: (
    competitionId: string,
    gymId: string,
    input: AssignCompetitionGymDto,
  ) => Promise<void>;
  onCreateGym: (input: CreateGymLocationDto) => Promise<void>;
  onIssueQr: (
    gymId: string,
    input: OperatorReasonDto,
  ) => Promise<GymQrCredential>;
  onRecordCash: (input: CashFulfillmentRequestDto) => Promise<void>;
  onRevokeQr: (gymId: string, input: OperatorReasonDto) => Promise<void>;
  onUpdateGym: (gymId: string, input: UpdateGymLocationDto) => Promise<void>;
  regions: RegionPolicy[];
  submitting: boolean;
};

const administrativeReason =
  "Configure the approved September 2026 static QR pilot.";
const posterStorageKey = "gogymgo.admin.pilot.active-poster";
const pilotAuditHiddenStorageKey = "gogymgo.admin.pilot.audit-hidden";

function isGymQrCredential(value: unknown): value is GymQrCredential {
  if (!value || typeof value !== "object") return false;
  const credential = value as Record<string, unknown>;
  return (
    Number.isInteger(credential.credentialVersion) &&
    Number(credential.credentialVersion) > 0 &&
    typeof credential.gymLocationId === "string" &&
    typeof credential.id === "string" &&
    typeof credential.issuedAt === "string" &&
    typeof credential.printablePosterSvg === "string" &&
    typeof credential.qrPayload === "string"
  );
}

function forgetStoredPoster(gymLocationId?: string) {
  if (typeof window === "undefined") return;
  try {
    if (gymLocationId) {
      const stored = JSON.parse(
        readStoredPosterValue() ?? "null",
      ) as unknown;
      if (
        isGymQrCredential(stored) &&
        stored.gymLocationId !== gymLocationId
      ) {
        return;
      }
    }
    window.localStorage.removeItem(posterStorageKey);
    window.sessionStorage.removeItem(posterStorageKey);
  } catch {
    // The poster preview remains usable even if browser storage is unavailable.
  }
}

function readStoredPosterValue() {
  if (typeof window === "undefined") return null;
  const durablePoster = window.localStorage.getItem(posterStorageKey);
  if (durablePoster) return durablePoster;

  const sessionPoster = window.sessionStorage.getItem(posterStorageKey);
  if (!sessionPoster) return null;
  window.localStorage.setItem(posterStorageKey, sessionPoster);
  window.sessionStorage.removeItem(posterStorageKey);
  return sessionPoster;
}

function readStoredPoster(gyms: GymLocation[]): GymQrCredential | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(readStoredPosterValue() ?? "null") as unknown;
    if (!isGymQrCredential(stored)) {
      forgetStoredPoster();
      return null;
    }
    const gym = gyms.find((candidate) => candidate.id === stored.gymLocationId);
    if (
      !gym?.active ||
      gym.activeCredentialVersion !== stored.credentialVersion
    ) {
      forgetStoredPoster();
      return null;
    }
    return stored;
  } catch {
    forgetStoredPoster();
    return null;
  }
}

function rememberPoster(credential: GymQrCredential) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(posterStorageKey, JSON.stringify(credential));
    window.sessionStorage.removeItem(posterStorageKey);
  } catch {
    // The newly issued poster still renders from component state.
  }
}

export function PilotOperationsPanel(props: PilotOperationsProps) {
  const createGymForm = useRef<HTMLFormElement>(null);
  const [poster, setPoster] = useState<GymQrCredential | null>(null);
  const [createGymError, setCreateGymError] = useState("");
  const [createGymSuccess, setCreateGymSuccess] = useState("");
  const [locatingGym, setLocatingGym] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [assignGymError, setAssignGymError] = useState("");
  const [assignGymSuccess, setAssignGymSuccess] = useState("");
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
    const restoreTimer = window.setTimeout(() => {
      const storedPoster = readStoredPoster(props.gyms);
      if (storedPoster) setPoster(storedPoster);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [props.gyms]);

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

    try {
      if (name.length < 2) throw new AdminUserFacingError("Partner gym name is required.");
      if (
        props.gyms.some(
          (gym) => gym.name.trim().toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new AdminUserFacingError(
          `${name} already exists. Select it in the assignment form below.`,
        );
      }
      if (address.length < 5) {
        throw new AdminUserFacingError("Enter the Partner gym's complete street address.");
      }
      if (!regionPolicyId) throw new AdminUserFacingError("Choose the Partner gym's region.");
      if (!Number.isInteger(radiusMeters) || radiusMeters < 10 || radiusMeters > 500) {
        throw new AdminUserFacingError("Radius must be a whole number from 10 to 500 metres.");
      }
      if (reason.length < 8) {
        throw new AdminUserFacingError("Administrative reason must be at least 8 characters.");
      }

      await props.onCreateGym({
        address,
        latitude: parseCoordinate(String(form.get("latitude") ?? ""), "latitude"),
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

    if (!navigator.geolocation) {
      setCreateGymError(
        "This browser cannot provide your location. Open the dashboard in Safari and try again.",
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
          setCreateGymError("The location fields could not be filled. Reload and try again.");
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
    const competitionId = String(form.get("competitionId") ?? "");
    const gymId = String(form.get("gymId") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    setAssignGymError("");
    setAssignGymSuccess("");

    try {
      if (!competitionId) throw new AdminUserFacingError("Choose a Contest.");
      if (!gymId) throw new AdminUserFacingError("Choose an active Partner gym.");
      if (reason.length < 8) {
        throw new AdminUserFacingError("Administrative reason must be at least 8 characters.");
      }
      await props.onAssignGym(competitionId, gymId, { reason });
      const gymName = props.gyms.find((gym) => gym.id === gymId)?.name ?? "Gym";
      setAssignGymSuccess(`${gymName} is assigned to the September contest.`);
    } catch (error) {
      setAssignGymError(formErrorMessage(error));
    }
  }

  async function recordCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await props.onRecordCash({
      amountCents: Number(form.get("amountCents")),
      currency: String(form.get("currency") ?? "CAD").toUpperCase(),
      reason: String(form.get("reason") ?? "").trim(),
      rewardAwardId: String(form.get("rewardAwardId") ?? "").trim(),
    });
    event.currentTarget.reset();
  }

  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">STATIC QR PILOT</p>
            <h2>Partner gyms + QR posters</h2>
            <p>
              Configure the exact geofence, issue one static poster and revoke
              it immediately if the credential is exposed.
            </p>
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
              <span>ADDRESS</span>
              <input name="address" required />
            </label>
            <label>
              <span>REGION</span>
              <select name="regionPolicyId" required>
                <option value="">Choose region</option>
                {props.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.metroName} ({region.code})
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
            <label className="pilot-form-wide">
              <span>ADMINISTRATIVE REASON</span>
              <input
                defaultValue={administrativeReason}
                name="reason"
                required
              />
            </label>
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
              {locatingGym ? "FINDING LOCATION..." : "USE MY CURRENT LOCATION"}
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
            {createGymError ? (
              <p className="pilot-form-message form-error" role="alert">
                {createGymError}
              </p>
            ) : null}
            {createGymSuccess ? (
              <p aria-live="polite" className="pilot-form-message form-success">
                {createGymSuccess}
              </p>
            ) : null}
          </form>
        </details>

        {props.gyms.length === 0 ? (
          <p className="empty-copy">
            No pilot Partner gym has been configured.
          </p>
        ) : (
          <div className="card-list pilot-gym-list">
            {props.gyms.map((gym) => (
              <GymCard
                gym={gym}
                key={gym.id}
                onIssue={async (input) => {
                  const credential = await props.onIssueQr(gym.id, input);
                  rememberPoster(credential);
                  setPoster(credential);
                }}
                onRevoke={async (input) => {
                  await props.onRevokeQr(gym.id, input);
                  forgetStoredPoster(gym.id);
                  setPoster((current) =>
                    current?.gymLocationId === gym.id ? null : current,
                  );
                }}
                onUpdate={(input) => props.onUpdateGym(gym.id, input)}
                submitting={props.submitting}
              />
            ))}
          </div>
        )}

        {poster ? <PosterPreview credential={poster} key={poster.id} /> : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CONTEST ELIGIBILITY</p>
            <h2>Assign a Partner gym to September</h2>
            <p>
              Link an active pilot Partner gym to the Contest members can join
              there.
            </p>
          </div>
        </div>
        <form className="pilot-form" noValidate onSubmit={assignGym}>
          <label>
            <span>CONTEST</span>
            <select name="competitionId" required>
              <option value="">Choose contest</option>
              {props.competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name} ({competition.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>PARTNER GYM</span>
            <select name="gymId" required>
              <option value="">Choose Partner gym</option>
              {props.gyms
                .filter((gym) => gym.active)
                .map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="pilot-form-wide">
            <span>ADMINISTRATIVE REASON</span>
            <input defaultValue={administrativeReason} name="reason" required />
          </label>
          <button
            className="primary-button"
            disabled={props.submitting}
            type="submit"
          >
            {props.submitting ? "ASSIGNING GYM..." : "ASSIGN GYM"}
          </button>
          {assignGymError ? (
            <p className="pilot-form-message form-error" role="alert">
              {assignGymError}
            </p>
          ) : null}
          {assignGymSuccess ? (
            <p aria-live="polite" className="pilot-form-message form-success">
              {assignGymSuccess}
            </p>
          ) : null}
        </form>
      </section>

      <PilotTable
        defaultOpen
        empty="No QR visits have been recorded."
        eyebrow="SERVER-AUTHORITATIVE VISITS"
        headings={["Gym", "Started", "Completed", "Status"]}
        rows={props.sessions.map((session) => [
          session.gymName,
          formatDateTime(session.startedAt),
          session.completedAt
            ? formatDateTime(session.completedAt)
            : "Missing exit scan",
          session.incomplete ? "incomplete" : session.status,
        ])}
        title="Sessions + incomplete visits"
      />

      <div className="pilot-two-column">
        <PilotTable
          empty="No unsupported-region requests."
          eyebrow="REGIONAL DEMAND"
          headings={["Email", "Requested region", "Status", "Submitted"]}
          rows={props.waitlist.map((entry) => [
            entry.email,
            entry.requestedRegion,
            entry.status,
            formatDateTime(entry.createdAt),
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
            <form className="pilot-form" onSubmit={recordCash}>
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
            </form>
          </div>
        </details>
      </section>

      {pilotAuditHidden ? (
        <section className="panel pilot-dismissed-panel">
          <div>
            <p className="eyebrow">APPEND-ONLY PILOT LEDGER</p>
            <h2>Pilot audit history cleared from view</h2>
            <p>
              The authoritative audit records are preserved. This dashboard
              preference affects only this device.
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
          eyebrow="APPEND-ONLY PILOT LEDGER"
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

function GymCard({
  gym,
  onIssue,
  onRevoke,
  onUpdate,
  submitting,
}: {
  gym: GymLocation;
  onIssue: (input: OperatorReasonDto) => Promise<void>;
  onRevoke: (input: OperatorReasonDto) => Promise<void>;
  onUpdate: (input: UpdateGymLocationDto) => Promise<void>;
  submitting: boolean;
}) {
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
  }

  return (
    <article className="region-card pilot-gym-card">
      <div className="region-code">QR</div>
      <div>
        <span className={`status-tag ${gym.active ? "active" : "archived"}`}>
          {gym.active ? "active" : "inactive"}
        </span>
        <h3>{gym.name}</h3>
        <p>{gym.address}</p>
        <small>
          {gym.latitude.toFixed(6)}, {gym.longitude.toFixed(6)} ·{" "}
          {gym.radiusMeters} m · QR v{gym.activeCredentialVersion || "—"}
        </small>
      </div>
      <div className="inline-actions pilot-gym-actions">
        <button
          className="primary-button"
          disabled={submitting}
          onClick={() => void onIssue({ reason: administrativeReason })}
          type="button"
        >
          ISSUE / REISSUE POSTER
        </button>
        <button
          className="danger-button"
          disabled={submitting || !gym.activeCredentialVersion}
          onClick={() =>
            void onRevoke({
              reason: "Revoke the current static QR credential.",
            })
          }
          type="button"
        >
          REVOKE QR
        </button>
      </div>
      <details className="pilot-details">
        <summary>Edit Partner gym + geofence</summary>
        <form className="pilot-form" onSubmit={update}>
          <label>
            <span>NAME</span>
            <input defaultValue={gym.name} name="name" required />
          </label>
          <label>
            <span>ADDRESS</span>
            <input defaultValue={gym.address} name="address" required />
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
          <label className="pilot-form-wide">
            <span>REASON</span>
            <input defaultValue={administrativeReason} name="reason" required />
          </label>
          <button
            className="secondary-button"
            disabled={submitting}
            type="submit"
          >
            SAVE PARTNER GYM
          </button>
        </form>
      </details>
    </article>
  );
}

function PosterPreview({ credential }: { credential: GymQrCredential }) {
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
          PRINTABLE QR POSTER · VERSION {credential.credentialVersion}
        </strong>
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
            <img alt="Printable GoGymGo gym QR poster" src={source} />
            <a
              className="primary-button"
              download={`gogymgo-gym-qr-v${credential.credentialVersion}.jpg`}
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
  rows: string[][];
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
              <span>Records remain preserved in the authoritative ledger.</span>
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
