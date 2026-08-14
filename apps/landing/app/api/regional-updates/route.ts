const PLATFORM_API_URL = process.env.GOGYMGO_API_URL?.replace(/\/+$/, "");

type RegionalUpdatePayload = {
  contactFax?: unknown;
  consent?: unknown;
  consentNoticeVersion?: unknown;
  email?: unknown;
  requestedRegion?: unknown;
};

const regionalUpdatesConsentNoticeVersion = "regional-updates-2026-08-13-v1";

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function upstreamError(status: number) {
  if (status === 429) {
    return "We’ve received several update requests. Please wait a few minutes and try again.";
  }
  if (status >= 500) {
    return "Regional updates are temporarily unavailable. Please try again shortly.";
  }
  return "Review your email and city or region, then try again.";
}

export async function POST(request: Request) {
  let payload: RegionalUpdatePayload;

  try {
    payload = (await request.json()) as RegionalUpdatePayload;
  } catch {
    return Response.json(
      { error: "Enter valid update details." },
      { status: 400 },
    );
  }

  if (clean(payload.contactFax, 200)) {
    return Response.json({ saved: true }, { status: 201 });
  }

  const email = clean(payload.email, 320);
  const requestedRegion = clean(payload.requestedRegion, 160);
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    requestedRegion.length < 2 ||
    payload.consent !== true ||
    payload.consentNoticeVersion !== regionalUpdatesConsentNoticeVersion
  ) {
    return Response.json(
      {
        error:
          "Enter your email and city or region, then confirm email updates.",
      },
      { status: 400 },
    );
  }

  if (!PLATFORM_API_URL) {
    return Response.json(
      {
        error:
          "Regional updates are temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${PLATFORM_API_URL}/v1/region-waitlist`, {
      body: JSON.stringify({
        consent: true,
        consentNoticeVersion: regionalUpdatesConsentNoticeVersion,
        email,
        requestedRegion,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Regional update request upstream rejected", {
        status: response.status,
      });
      return Response.json(
        { error: upstreamError(response.status) },
        { status: response.status },
      );
    }

    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    console.error("Regional update request upstream unavailable", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: "We couldn't save your update request. Please try again." },
      { status: 502 },
    );
  }
}
