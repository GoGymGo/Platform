"use client";

import type { User } from "firebase/auth";
import type { AuditEvent, Competition, WorkQueueItem } from "./admin-types";
import {
  FirebaseTokenUnavailableError,
  sendWithFirebaseTokenRecovery,
} from "./admin-auth-request.mjs";

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
  return {
    after:
      summarizeAuditState(event.after) ||
      "No resulting state recorded by server",
    before:
      summarizeAuditState(event.before) ||
      "No previous state recorded by server",
  };
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
  if (code.includes("too-many-requests"))
    return "Too many sign-in attempts were made. Wait a moment and try again.";
  if (code.includes("network-request-failed"))
    return "Sign-in could not reach Firebase. Check your connection and try again.";
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
    idempotencyKey?: string;
    method?: HttpMethod;
  } = {},
): Promise<T> {
  const mutationFingerprint = options.method
    ? `${options.method}:${path}:${JSON.stringify(options.body ?? null)}`
    : null;
  const idempotencyKey = mutationFingerprint
    ? (options.idempotencyKey ?? pendingAdminMutationKey(mutationFingerprint))
    : null;

  let response: Response;
  try {
    response = await sendWithFirebaseTokenRecovery(
      activeUser,
      (token: string) =>
        fetch(`/api/gogymgo/${path}`, {
          body: options.body ? JSON.stringify(options.body) : undefined,
          cache: "no-store",
          headers: {
            authorization: `Bearer ${token}`,
            ...(options.body ? { "content-type": "application/json" } : {}),
            ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
          },
          method: options.method ?? "GET",
        }),
    );
  } catch (error) {
    if (error instanceof FirebaseTokenUnavailableError) {
      const sessionError = new AdminRequestError(
        "Your admin session expired. Sign out and sign in again.",
      );
      Object.assign(sessionError, {
        code: "ADMIN_SESSION_EXPIRED",
        status: 401,
      });
      throw sessionError;
    }
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
    if (
      mutationFingerprint &&
      response.status < 500 &&
      apiError?.code !== "IDEMPOTENCY_REQUEST_IN_PROGRESS"
    ) {
      clearPendingAdminMutationKey(mutationFingerprint);
    }
    Object.assign(error, {
      code: apiError?.code,
      status: response.status,
    });
    throw error;
  }
  if (mutationFingerprint) {
    clearPendingAdminMutationKey(mutationFingerprint);
  }
  return payload as T;
}

export function clearAdminRequestSession(): void {
  try {
    sessionStorage.removeItem(pendingAdminMutationsStorageKey);
  } catch {
    // Firebase sign-out is still authoritative when browser storage is blocked.
  }
}

const pendingAdminMutationsStorageKey =
  "gogymgo.admin.pending-idempotency-keys.v1";

function pendingAdminMutationKey(fingerprint: string) {
  try {
    const pending = readPendingAdminMutationKeys();
    const existing = pending[fingerprint];
    if (existing) return existing;
    const created = `admin-${crypto.randomUUID()}`;
    sessionStorage.setItem(
      pendingAdminMutationsStorageKey,
      JSON.stringify({ ...pending, [fingerprint]: created }),
    );
    return created;
  } catch {
    return `admin-${crypto.randomUUID()}`;
  }
}

function clearPendingAdminMutationKey(fingerprint: string) {
  try {
    const pending = readPendingAdminMutationKeys();
    delete pending[fingerprint];
    if (Object.keys(pending).length === 0) {
      sessionStorage.removeItem(pendingAdminMutationsStorageKey);
    } else {
      sessionStorage.setItem(
        pendingAdminMutationsStorageKey,
        JSON.stringify(pending),
      );
    }
  } catch {
    // Storage availability never changes the authoritative API result.
  }
}

function readPendingAdminMutationKeys(): Record<string, string> {
  const raw = sessionStorage.getItem(pendingAdminMutationsStorageKey);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].startsWith("admin-"),
    ),
  );
}
