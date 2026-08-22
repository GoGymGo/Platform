import {
  hasExactKeys,
  methodNotAllowed,
  publicJsonError,
  readSameOriginJsonObject,
} from "./public-site-request";

const regionalUpdatesConsentNoticeVersion =
  "regional-updates-2026-08-13-v1";
const partnershipInterests = [
  "regional-sponsor",
  "brand-rewards",
  "creator-campaign",
  "gym-partnership",
  "explore",
] as const;
const retryableStatuses = new Set([502, 503, 504]);

type Forwarder = (
  path: "/v1/interest-submissions" | "/v1/region-waitlist",
  submissionId: string,
  body: Record<string, unknown>,
) => Promise<Response>;

export type LandingIntakeDependencies = {
  forward?: Forwarder;
};

export async function handleRegionalUpdates(
  request: Request,
  dependencies: LandingIntakeDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }
  const parsed = await readSameOriginJsonObject(request, 1_400);
  if (!parsed.ok) {
    return parsed.response;
  }
  if (
    !hasExactKeys(
      parsed.value,
      [
        "consent",
        "consentNoticeVersion",
        "contactFax",
        "email",
        "requestedRegion",
        "submissionId",
      ],
      [
        "consent",
        "consentNoticeVersion",
        "contactFax",
        "email",
        "requestedRegion",
        "submissionId",
      ],
    )
  ) {
    return publicJsonError("Enter valid update details.", 400);
  }

  const contactFax = optionalBoundedString(parsed.value.contactFax, 200);
  const email = requiredBoundedString(parsed.value.email, 320)?.toLowerCase();
  const requestedRegion = requiredBoundedString(
    parsed.value.requestedRegion,
    160,
  );
  const submissionId = readUuid(parsed.value.submissionId);
  if (contactFax === null) {
    return publicJsonError("Enter valid update details.", 400);
  }
  if (contactFax) {
    return Response.json({ saved: true }, { status: 201 });
  }
  if (
    !email ||
    !isEmail(email) ||
    !requestedRegion ||
    requestedRegion.length < 2 ||
    !submissionId ||
    parsed.value.consent !== true ||
    parsed.value.consentNoticeVersion !==
      regionalUpdatesConsentNoticeVersion
  ) {
    return publicJsonError(
      "Enter your email and city or region, then confirm email updates.",
      400,
    );
  }

  return forwardPublicIntake(
    dependencies.forward,
    "/v1/region-waitlist",
    submissionId,
    {
      consent: true,
      consentNoticeVersion: regionalUpdatesConsentNoticeVersion,
      email,
      requestedRegion,
    },
    "Regional updates",
  );
}

export async function handlePartnershipInterest(
  request: Request,
  dependencies: LandingIntakeDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }
  const parsed = await readSameOriginJsonObject(request, 5_000);
  if (!parsed.ok) {
    return parsed.response;
  }
  if (
    !hasExactKeys(
      parsed.value,
      [
        "audience",
        "companyName",
        "consent",
        "contactFax",
        "email",
        "fullName",
        "message",
        "partnershipInterest",
        "region",
        "submissionId",
        "website",
      ],
      [
        "audience",
        "companyName",
        "consent",
        "email",
        "fullName",
        "partnershipInterest",
        "region",
        "submissionId",
      ],
    )
  ) {
    return publicJsonError("Enter valid form details.", 400);
  }

  const contactFax = optionalBoundedString(parsed.value.contactFax, 200);
  const companyName = requiredBoundedString(parsed.value.companyName, 140);
  const email = requiredBoundedString(parsed.value.email, 320)?.toLowerCase();
  const fullName = requiredBoundedString(parsed.value.fullName, 100);
  const message = optionalBoundedString(parsed.value.message, 1_200);
  const partnershipInterest = requiredBoundedString(
    parsed.value.partnershipInterest,
    80,
  );
  const region = requiredBoundedString(parsed.value.region, 160);
  const submissionId = readUuid(parsed.value.submissionId);
  const website = optionalBoundedString(parsed.value.website, 300);
  if (contactFax === null || message === null || website === null) {
    return publicJsonError("Enter valid form details.", 400);
  }
  if (contactFax) {
    return Response.json({ saved: true }, { status: 201 });
  }
  if (
    parsed.value.audience !== "brand" ||
    !fullName ||
    fullName.length < 2 ||
    !companyName ||
    companyName.length < 2 ||
    !email ||
    !isEmail(email) ||
    !region ||
    region.length < 2 ||
    !partnershipInterest ||
    !partnershipInterests.includes(
      partnershipInterest as (typeof partnershipInterests)[number],
    ) ||
    !submissionId ||
    (website && !isHttpUrl(website)) ||
    parsed.value.consent !== true
  ) {
    return publicJsonError("Review your partnership details and try again.", 400);
  }

  return forwardPublicIntake(
    dependencies.forward,
    "/v1/interest-submissions",
    submissionId,
    {
      audience: "brand",
      companyName,
      consent: true,
      email,
      fullName,
      ...(message ? { message } : {}),
      partnershipInterest,
      region,
      ...(website ? { website } : {}),
    },
    "Partnership requests",
  );
}

export async function forwardLandingIntake(
  path: "/v1/interest-submissions" | "/v1/region-waitlist",
  submissionId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const apiUrl = process.env.GOGYMGO_API_URL?.trim().replace(/\/+$/, "");
  const forwardingSecret =
    process.env.GOGYMGO_LANDING_FORWARDING_SECRET?.trim();
  if (
    !apiUrl ||
    !isAllowedApiUrl(apiUrl) ||
    !forwardingSecret ||
    forwardingSecret.length < 32
  ) {
    return publicJsonError(
      "This form is temporarily unavailable. Please try again shortly.",
      503,
    );
  }

  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        body: JSON.stringify(body),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
          "Idempotency-Key": submissionId,
          "X-GoGymGo-Landing-Key": forwardingSecret,
        },
        method: "POST",
        signal: AbortSignal.timeout(5_000),
      });
      lastResponse = response;
      if (!retryableStatuses.has(response.status) || attempt === 1) {
        return response;
      }
    } catch {
      if (attempt === 1) {
        return publicJsonError(
          "This form is temporarily unavailable. Please try again shortly.",
          502,
        );
      }
    }
  }
  return (
    lastResponse ??
    publicJsonError(
      "This form is temporarily unavailable. Please try again shortly.",
      502,
    )
  );
}

async function forwardPublicIntake(
  forward: Forwarder | undefined,
  path: "/v1/interest-submissions" | "/v1/region-waitlist",
  submissionId: string,
  body: Record<string, unknown>,
  label: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await (forward ?? forwardLandingIntake)(
      path,
      submissionId,
      body,
    );
  } catch {
    return publicJsonError(
      `${label} are temporarily unavailable. Please try again shortly.`,
      502,
    );
  }
  if (!response.ok) {
    const authorityUnavailable =
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404 ||
      response.status >= 500;
    const status = response.status === 429 ? 429 : authorityUnavailable ? 503 : 400;
    return publicJsonError(upstreamError(label, status), status, {
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    });
  }
  let receipt: unknown;
  try {
    receipt = await response.json();
  } catch {
    return publicJsonError(
      `${label} are temporarily unavailable. Please try again shortly.`,
      503,
    );
  }
  if (!isAuthoritativeReceipt(path, receipt)) {
    return publicJsonError(
      `${label} are temporarily unavailable. Please try again shortly.`,
      503,
    );
  }
  return Response.json({ saved: true }, { status: 201 });
}

function isAuthoritativeReceipt(
  path: "/v1/interest-submissions" | "/v1/region-waitlist",
  value: unknown,
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const receipt = value as Record<string, unknown>;
  if (path === "/v1/region-waitlist") {
    return (
      hasExactKeys(receipt, ["status"], ["status"]) &&
      receipt.status === "received"
    );
  }
  return (
    hasExactKeys(
      receipt,
      ["audience", "id", "submittedAt"],
      ["audience", "id", "submittedAt"],
    ) &&
    receipt.audience === "brand" &&
    readUuid(receipt.id) !== null &&
    isIsoDateTime(receipt.submittedAt)
  );
}

function upstreamError(label: string, status: number): string {
  if (status === 429) {
    return `We’ve received several ${label.toLowerCase()}. Please wait a minute and try again.`;
  }
  if (status >= 500) {
    return `${label} are temporarily unavailable. Please try again shortly.`;
  }
  return `Review your details and try again.`;
}

function requiredBoundedString(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string" || value.length > maximumLength) {
    return null;
  }
  const cleaned = value.trim();
  return cleaned || null;
}

function optionalBoundedString(value: unknown, maximumLength: number): string | null {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string" || value.length > maximumLength) {
    return null;
  }
  return value.trim();
}

function readUuid(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value.toLowerCase()
    : null;
}

function isIsoDateTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isAllowedApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isLoopback =
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:");
    return (
      (url.protocol === "https:" || isLoopback) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
