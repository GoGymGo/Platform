"use client";

import type {
  AssignCompetitionGymDto,
  CashFulfillmentRequestDto,
  CreateGymLocationDto,
  OperatorReasonDto,
  UpdateGymLocationDto,
} from "@gogymgo/contracts";
import { FormEvent, useState } from "react";
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

export function PilotOperationsPanel(props: PilotOperationsProps) {
  const [poster, setPoster] = useState<GymQrCredential | null>(null);

  async function createGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await props.onCreateGym({
      address: String(form.get("address") ?? "").trim(),
      latitude: Number(form.get("latitude")),
      longitude: Number(form.get("longitude")),
      name: String(form.get("name") ?? "").trim(),
      radiusMeters: Number(form.get("radiusMeters")),
      reason: String(form.get("reason") ?? "").trim(),
      regionPolicyId: String(form.get("regionPolicyId") ?? ""),
    });
    event.currentTarget.reset();
  }

  async function assignGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await props.onAssignGym(
      String(form.get("competitionId") ?? ""),
      String(form.get("gymId") ?? ""),
      { reason: String(form.get("reason") ?? "").trim() },
    );
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
            <h2>Gym locations + posters</h2>
            <p>
              Configure the exact geofence, issue one static poster and revoke
              it immediately if the credential is exposed.
            </p>
          </div>
        </div>
        <form className="pilot-form" onSubmit={createGym}>
          <label>
            <span>GYM NAME</span>
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
              max="180"
              min="-180"
              name="longitude"
              required
              step="any"
              type="number"
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
            <input defaultValue={administrativeReason} name="reason" required />
          </label>
          <button
            className="primary-button"
            disabled={props.submitting}
            type="submit"
          >
            + CREATE GYM
          </button>
        </form>

        {props.gyms.length === 0 ? (
          <p className="empty-copy">No pilot gym has been configured.</p>
        ) : (
          <div className="card-list pilot-gym-list">
            {props.gyms.map((gym) => (
              <GymCard
                gym={gym}
                key={gym.id}
                onIssue={async (input) =>
                  setPoster(await props.onIssueQr(gym.id, input))
                }
                onRevoke={(input) => props.onRevokeQr(gym.id, input)}
                onUpdate={(input) => props.onUpdateGym(gym.id, input)}
                submitting={props.submitting}
              />
            ))}
          </div>
        )}

        {poster ? (
          <PosterPreview credential={poster} onClose={() => setPoster(null)} />
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">COMPETITION ELIGIBILITY</p>
            <h2>Assign a gym to September</h2>
          </div>
        </div>
        <form className="pilot-form" onSubmit={assignGym}>
          <label>
            <span>COMPETITION</span>
            <select name="competitionId" required>
              <option value="">Choose competition</option>
              {props.competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name} ({competition.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>GYM</span>
            <select name="gymId" required>
              <option value="">Choose gym</option>
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
            ASSIGN GYM
          </button>
        </form>
      </section>

      <PilotTable
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

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">IN-PERSON CASH HANDOFF</p>
            <h2>Record fulfillment</h2>
            <p>
              The draw must already be settled. This action is permanent and
              audited.
            </p>
          </div>
        </div>
        <form className="pilot-form" onSubmit={recordCash}>
          <label className="pilot-form-wide">
            <span>REWARD AWARD ID</span>
            <input name="rewardAwardId" required />
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
      </section>

      <PilotTable
        empty="No pilot audit events."
        eyebrow="APPEND-ONLY PILOT LEDGER"
        headings={["Action", "Entity", "Reason", "Time"]}
        rows={props.auditEvents.map((entry) => [
          entry.action,
          `${entry.entityType} · ${entry.entityId}`,
          entry.reason,
          formatDateTime(entry.createdAt),
        ])}
        title="Pilot audit history"
      />
    </div>
  );
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
        <summary>Edit gym + geofence</summary>
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
            SAVE GYM
          </button>
        </form>
      </details>
    </article>
  );
}

function PosterPreview({
  credential,
  onClose,
}: {
  credential: GymQrCredential;
  onClose: () => void;
}) {
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(credential.printablePosterSvg)}`;
  return (
    <div className="poster-preview">
      <div>
        <strong>
          PRINTABLE QR POSTER · VERSION {credential.credentialVersion}
        </strong>
        <button className="text-button" onClick={onClose} type="button">
          Close
        </button>
      </div>
      {/* The SVG is rendered as an image, never injected as executable markup. */}
      {/* Generated data URLs cannot use the Sites image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Printable GoGymGo gym QR poster" src={source} />
      <a
        className="primary-button"
        download={`gogymgo-gym-qr-v${credential.credentialVersion}.svg`}
        href={source}
      >
        DOWNLOAD SVG FOR PRINTING
      </a>
    </div>
  );
}

function PilotTable({
  empty,
  eyebrow,
  headings,
  rows,
  title,
}: {
  empty: string;
  eyebrow: string;
  headings: string[];
  rows: string[][];
  title: string;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="empty-copy">{empty}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {headings.map((heading) => (
                  <th key={heading}>{heading}</th>
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
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
