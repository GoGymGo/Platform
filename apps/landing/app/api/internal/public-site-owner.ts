import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { publicNoStoreHeaders } from "@/app/api/public-site-request";

export const ownerNoStoreHeaders = {
  ...publicNoStoreHeaders,
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export type PublicSiteOwnerConfig = {
  email: string;
  userId: string;
};

export type FeedbackCursor = {
  createdAt: string;
  id: string;
  kind: "feedback";
};

export type EventCursor = {
  day: string;
  eventName: string;
  kind: "events";
};

export type ExportPage<TCursor> = {
  cursor: TCursor | null;
  limit: number;
};

export function readPublicSiteOwnerConfig(
  values: Record<string, string | undefined>,
  enableVariable: "LANDING_D1_EXPORT_ENABLED" | "LANDING_D1_RETENTION_ENABLED",
): PublicSiteOwnerConfig | null {
  if (values[enableVariable] !== "yes") {
    return null;
  }

  const email = values.LANDING_D1_EXPORT_OWNER_EMAIL?.trim().toLowerCase();
  const userId = values.LANDING_D1_EXPORT_OWNER_USER_ID?.trim();
  if (
    !email ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !userId ||
    userId.length > 256 ||
    /\s/.test(userId)
  ) {
    return null;
  }

  return { email, userId };
}

export async function isAuthorizedPublicSiteOwner(
  user: ChatGPTUser | null,
  config: PublicSiteOwnerConfig,
  compare: (provided: string, expected: string) => Promise<boolean> =
    constantTimeEqual,
): Promise<boolean> {
  if (!user?.id) {
    return false;
  }

  const [emailMatches, idMatches] = await Promise.all([
    compare(user.email.trim().toLowerCase(), config.email),
    compare(user.id.trim(), config.userId),
  ]);
  return emailMatches && idMatches;
}

export function unavailableOwnerRoute(): Response {
  return new Response(null, { headers: ownerNoStoreHeaders, status: 404 });
}

export function ownerError(error: string, status: number): Response {
  return Response.json(
    { error },
    { headers: ownerNoStoreHeaders, status },
  );
}

export function exportHeaders(filename: string): HeadersInit {
  return {
    ...ownerNoStoreHeaders,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Security-Policy": "default-src 'none'",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export function readFeedbackExportPage(
  request: Request,
): ExportPage<FeedbackCursor> | null {
  const parsed = readPageParameters(request);
  if (!parsed) {
    return null;
  }
  if (!parsed.cursor) {
    return { cursor: null, limit: parsed.limit };
  }
  const cursor = decodeCursor(parsed.cursor);
  return isFeedbackCursor(cursor)
    ? { cursor, limit: parsed.limit }
    : null;
}

export function readEventExportPage(
  request: Request,
): ExportPage<EventCursor> | null {
  const parsed = readPageParameters(request);
  if (!parsed) {
    return null;
  }
  if (!parsed.cursor) {
    return { cursor: null, limit: parsed.limit };
  }
  const cursor = decodeCursor(parsed.cursor);
  return isEventCursor(cursor) ? { cursor, limit: parsed.limit } : null;
}

export function encodeExportCursor(
  cursor: FeedbackCursor | EventCursor,
): string {
  return btoa(JSON.stringify(cursor))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function constantTimeEqual(
  provided: string,
  expected: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const workersSubtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean;
  };
  return workersSubtle.timingSafeEqual(providedHash, expectedHash);
}

function readPageParameters(
  request: Request,
): { cursor: string | null; limit: number } | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  for (const key of url.searchParams.keys()) {
    if (key !== "cursor" && key !== "limit") {
      return null;
    }
    if (url.searchParams.getAll(key).length !== 1) {
      return null;
    }
  }

  const rawLimit = url.searchParams.get("limit");
  if (rawLimit !== null && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(rawLimit)) {
    return null;
  }
  const cursor = url.searchParams.get("cursor");
  if (cursor !== null && (cursor.length === 0 || cursor.length > 512)) {
    return null;
  }

  return { cursor, limit: rawLimit === null ? 50 : Number(rawLimit) };
}

function decodeCursor(value: string): unknown {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as unknown;
  } catch {
    return null;
  }
}

function isFeedbackCursor(value: unknown): value is FeedbackCursor {
  return (
    isExactObject(value, ["createdAt", "id", "kind"]) &&
    value.kind === "feedback" &&
    typeof value.createdAt === "string" &&
    isIsoTimestamp(value.createdAt) &&
    typeof value.id === "string" &&
    value.id.length >= 1 &&
    value.id.length <= 64
  );
}

function isEventCursor(value: unknown): value is EventCursor {
  return (
    isExactObject(value, ["day", "eventName", "kind"]) &&
    value.kind === "events" &&
    typeof value.day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.day) &&
    typeof value.eventName === "string" &&
    /^[a-z_]{1,80}$/.test(value.eventName)
  );
}

function isExactObject(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}
