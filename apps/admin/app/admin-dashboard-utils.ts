"use client";

import type { User } from "firebase/auth";
import type { AuditEvent, Competition, WorkQueueItem } from "./admin-types";

export type HttpMethod = "POST" | "PUT";

export function getQueueUrgency(item: WorkQueueItem) {
  const ageHours = Math.max(
    0,
    (Date.now() - new Date(item.createdAt).getTime()) / 3_600_000,
  );
  const normalized = `${item.kind} ${item.status}`.toLowerCase();
  if (
    ageHours >= 24 ||
    normalized.includes("failed") ||
    normalized.includes("rejected") ||
    normalized.includes("privacy")
  ) {
    return { label: "URGENT", tone: "urgent" } as const;
  }
  if (ageHours >= 8 || normalized.includes("pending_review")) {
    return { label: "DUE SOON", tone: "warning" } as const;
  }
  return { label: "ROUTINE", tone: "routine" } as const;
}

export function formatQueueAge(value: string) {
  const ageMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (ageMinutes < 60) return `${ageMinutes}m`;
  const ageHours = Math.round(ageMinutes / 60);
  if (ageHours < 48) return `${ageHours}h`;
  return `${Math.round(ageHours / 24)}d`;
}

export function getCompetitionDeadline(competition: Competition) {
  const now = Date.now();
  const stages =
    competition.status === "draft"
      ? [
          [competition.registrationOpensAt, "Registration opens"],
          [competition.startsAt, "Competition starts"],
        ]
      : competition.status === "registration"
        ? [
            [competition.registrationClosesAt, "Registration closes"],
            [competition.startsAt, "Competition starts"],
          ]
        : [[competition.endsAt, "Competition ends"]];
  const next = stages.find(([value]) => new Date(value).getTime() > now);
  if (!next) {
    return { detail: "No future player deadline", label: "COMPLETE", tone: "routine" };
  }
  const hours = Math.max(0, (new Date(next[0]).getTime() - now) / 3_600_000);
  const label =
    hours < 24 ? `${Math.max(1, Math.ceil(hours))}H` : `${Math.ceil(hours / 24)}D`;
  return {
    detail: next[1],
    label,
    tone: hours <= 48 ? "urgent" : hours <= 168 ? "warning" : "routine",
  };
}

export function getAuditChange(event: AuditEvent) {
  if (event.before || event.after) {
    return {
      after: summarizeAuditState(event.after) || "No resulting state recorded",
      before: summarizeAuditState(event.before) || "No previous state recorded",
    };
  }
  const action = event.action.toLowerCase();
  const transitions: Array<[string, string, string]> = [
    ["publish", "draft", "published"],
    ["archive", "published", "archived"],
    ["cancel", "scheduled or open", "cancelled"],
    ["withdraw", "effective or scheduled", "withdrawn"],
    ["revoke", "active", "revoked"],
    ["approve", "pending review", "approved"],
    ["reject", "pending review", "rejected"],
    ["create", "not present", "created"],
    ["update", "previous version", "updated version"],
  ];
  const transition = transitions.find(([token]) => action.includes(token));
  return transition
    ? { after: transition[2], before: transition[1] }
    : { after: event.action.replaceAll("_", " "), before: "existing record" };
}

function summarizeAuditState(value?: Record<string, unknown> | null) {
  if (!value) return "";
  return Object.entries(value)
    .slice(0, 3)
    .map(([key, entry]) => `${key}: ${String(entry)}`)
    .join(" · ");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Vancouver",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Vancouver",
    year: "numeric",
  }).format(new Date(value));
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("invalid-credential")) return "The email or password is incorrect.";
  if (code.includes("popup-closed")) return "The sign-in window was closed before authentication finished.";
  if (code.includes("popup-blocked")) return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
  return errorMessage(error);
}

export function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIso(form: FormData, name: string) {
  const value = String(form.get(name) ?? "");
  if (!value) throw new Error(`${name} is required.`);
  return new Date(value).toISOString();
}

export function optionalIso(value: FormDataEntryValue | null) {
  const normalized = optionalString(value);
  return normalized ? new Date(normalized).toISOString() : undefined;
}

export function optionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

export function optionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? Number(normalized) : undefined;
}

export function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ""),
  );
}

export function defaultCompetitionDates() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 7));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 7));
  return {
    endsAt: end.toISOString(),
    monthKey: start.toISOString().slice(0, 7),
    registrationOpensAt: now.toISOString(),
    startsAt: start.toISOString(),
  };
}

export async function adminRequest<T>(
  activeUser: User,
  path: string,
  options: { body?: unknown; method?: HttpMethod } = {},
): Promise<T> {
  const token = await activeUser.getIdToken();
  const response = await fetch(`/api/gogymgo/${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.method ? { "idempotency-key": crypto.randomUUID() } : {}),
    },
    method: options.method ?? "GET",
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | T
    | null;
  if (!response.ok) {
    const apiError =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (
            payload as {
              error?: { code?: string; message?: string };
            }
          ).error
        : undefined;
    const message =
      apiError?.message ?? "The GoGymGo API rejected this request.";
    const error = new Error(message || "The request could not be completed.");
    Object.assign(error, {
      code: apiError?.code,
      status: response.status,
    });
    throw error;
  }
  return payload as T;
}
