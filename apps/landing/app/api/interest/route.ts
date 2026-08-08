const PLATFORM_API_URL = process.env.GOGYMGO_API_URL?.replace(/\/+$/, "");

type InterestPayload = {
  companyName?: unknown;
  consent?: unknown;
  contactFax?: unknown;
  email?: unknown;
  fullName?: unknown;
  message?: unknown;
  partnershipInterest?: unknown;
  region?: unknown;
  website?: unknown;
};

const partnershipInterests = new Set([
  "regional-sponsor",
  "brand-rewards",
  "creator-campaign",
  "gym-partnership",
  "explore",
]);

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidWebsite(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function upstreamError(status: number) {
  if (status === 429) {
    return "We’ve received several partnership requests. Please wait a few minutes and try again.";
  }
  if (status >= 500) {
    return "Partnership requests are temporarily unavailable. Please try again shortly.";
  }
  return "Review your partnership details and try again.";
}

export async function POST(request: Request) {
  let payload: InterestPayload;

  try {
    payload = (await request.json()) as InterestPayload;
  } catch {
    return Response.json({ error: "Enter valid form details." }, { status: 400 });
  }

  // Quietly accept the hidden honeypot so automated submissions learn nothing.
  if (clean(payload.contactFax, 200)) {
    return Response.json({ saved: true }, { status: 201 });
  }

  const companyName = clean(payload.companyName, 140);
  const email = clean(payload.email, 320).toLowerCase();
  const fullName = clean(payload.fullName, 100);
  const message = clean(payload.message, 1_200);
  const partnershipInterest = clean(payload.partnershipInterest, 80);
  const region = clean(payload.region, 160);
  const website = clean(payload.website, 300);

  if (fullName.length < 2) {
    return Response.json({ error: "Enter your name." }, { status: 400 });
  }
  if (companyName.length < 2) {
    return Response.json(
      { error: "Enter your gym or company name." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "Enter a valid work email address." },
      { status: 400 },
    );
  }
  if (region.length < 2) {
    return Response.json(
      { error: "Enter a target city or region." },
      { status: 400 },
    );
  }
  if (!partnershipInterests.has(partnershipInterest)) {
    return Response.json(
      { error: "Choose a partnership interest." },
      { status: 400 },
    );
  }
  if (!isValidWebsite(website)) {
    return Response.json(
      { error: "Enter a full website address beginning with http:// or https://." },
      { status: 400 },
    );
  }
  if (payload.consent !== true) {
    return Response.json(
      { error: "Please confirm that GoGymGo may contact you about this request." },
      { status: 400 },
    );
  }

  if (!PLATFORM_API_URL) {
    return Response.json(
      { error: "Partnership requests are temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${PLATFORM_API_URL}/v1/interest-submissions`, {
      body: JSON.stringify({
        audience: "brand",
        companyName,
        consent: true,
        email,
        fullName,
        ...(message ? { message } : {}),
        partnershipInterest,
        region,
        ...(website ? { website } : {}),
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Partnership request upstream rejected", {
        status: response.status,
      });
      return Response.json(
        { error: upstreamError(response.status) },
        { status: response.status },
      );
    }

    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    console.error("Partnership request upstream unavailable", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: "Partnership requests are temporarily unavailable. Please try again shortly." },
      { status: 502 },
    );
  }
}
