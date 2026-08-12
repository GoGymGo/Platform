"use client";

import type { User } from "firebase/auth";
import type { AuditEvent, Competition, WorkQueueItem } from "./admin-types";

export type HttpMethod = "DELETE" | "POST" | "PUT";

export function isOperationalCompetition(competition: Competition) {
  return ["draft", "registration", "active"].includes(competition.status);
}

export function isRewardConfigurableCompetition(competition: Competition) {
  return ["draft", "registration"].includes(competition.status);
}

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
    ["delete", "retired record", "deleted from dashboard"],
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

export class AdminUserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserFacingError";
  }
}

export function errorMessage(error: unknown) {
  return error instanceof AdminUserFacingError
    ? error.message
    : "The request could not be completed. Try again.";
}

export function adminRequestStatus(error: unknown) {
  return typeof error === "object" && error && "status" in error
    ? Number(error.status)
    : 0;
}

export function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("invalid-credential"))
    return "The email or password is incorrect.";
  if (code.includes("popup-closed"))
    return "The sign-in window was closed before authentication finished.";
  if (code.includes("popup-blocked"))
    return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
  return "Sign-in could not be completed. Check your connection and try again.";
}

class AdminRequestError extends AdminUserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "AdminRequestError";
  }
}

function adminRequestErrorMessage(
  status: number,
  apiError?: { code?: string; message?: string },
) {
  if (status === 401) return "Your admin session expired. Sign in again.";
  if (status === 403)
    return "Your account does not have permission to complete this action.";
  if (status === 404)
    return "This record is no longer available. Refresh the dashboard and try again.";
  if (status === 409) {
    const conflictMessage = apiError?.message?.trim();
    return conflictMessage
      ? conflictMessage
      : "This action conflicts with the latest record. Refresh the dashboard and review it before trying again.";
  }
  if (status === 400 || status === 422)
    return "The request could not be completed. Review the form and try again.";
  if (status === 429)
    return "Too many requests were submitted. Wait a moment and try again.";
  if (status >= 500)
    return "The GoGymGo admin service is temporarily unavailable. Try again shortly.";
  return "The request could not be completed. Try again.";
}

export function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIso(form: FormData, name: string) {
  const value = String(form.get(name) ?? "");
  if (!value) throw new AdminUserFacingError(`${name} is required.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminUserFacingError(`Enter a valid ${name}.`);
  }
  return date.toISOString();
}

export function optionalIso(value: FormDataEntryValue | null) {
  const normalized = optionalString(value);
  if (!normalized) return undefined;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new AdminUserFacingError("Enter a valid date and time.");
  }
  return date.toISOString();
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
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

export function defaultCompetitionDates() {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 7),
  );
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 7),
  );
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
  options: {
    body?: unknown;
    expectedStatuses?: number[];
    method?: HttpMethod;
  } = {},
): Promise<T> {
  let token: string;
  try {
    token = await activeUser.getIdToken();
  } catch {
    throw new AdminRequestError(
      "Your admin session could not be confirmed. Sign in again.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`/api/gogymgo/${path}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.method ? { "idempotency-key": crypto.randomUUID() } : {}),
      },
      method: options.method ?? "GET",
    });
  } catch {
    throw new AdminRequestError(
      "The GoGymGo admin service could not be reached. Check your connection and try again.",
    );
  }
  const payload = (await response.json().catch(() => null)) as
    { error?: { code?: string; message?: string } } | T | null;
  if (!response.ok) {
    const apiError =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (
            payload as {
              error?: { code?: string; message?: string };
            }
          ).error
        : undefined;
    if (!options.expectedStatuses?.includes(response.status)) {
      console.error("GoGymGo admin request failed", {
        code: apiError?.code,
        path,
        status: response.status,
      });
    }
    const error = new AdminRequestError(
      adminRequestErrorMessage(response.status, apiError),
    );
    Object.assign(error, {
      code: apiError?.code,
      status: response.status,
    });
    throw error;
  }
  return payload as T;
}
