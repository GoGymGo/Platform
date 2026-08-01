import { env } from "cloudflare:workers";
import { ensureInterestTable } from "../../../db/ensureInterestTable";

type Audience = "gym_goer" | "brand";

type InterestPayload = {
  audience?: unknown;
  companyName?: unknown;
  consent?: unknown;
  contactFax?: unknown;
  discoverySource?: unknown;
  email?: unknown;
  fullName?: unknown;
  goalDays?: unknown;
  interest?: unknown;
  message?: unknown;
  region?: unknown;
  website?: unknown;
  workoutStyle?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSafeWebsite(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as InterestPayload;

    if (clean(payload.contactFax, 200)) {
      return Response.json({ saved: true }, { status: 201 });
    }

    const audience = clean(payload.audience, 20) as Audience;
    const email = clean(payload.email, 254).toLowerCase();
    const fullName = clean(payload.fullName, 100);
    const companyName = clean(payload.companyName, 140);
    const website = clean(payload.website, 300);
    const region = clean(payload.region, 160);
    const workoutStyle = clean(payload.workoutStyle, 60);
    const partnershipInterest = clean(payload.interest, 80);
    const discoverySource = clean(payload.discoverySource, 80);
    const message = clean(payload.message, 1200);
    const goalDays = Number(payload.goalDays);
    const consent = payload.consent === true;

    if (audience !== "gym_goer" && audience !== "brand") {
      return badRequest("Choose a valid registration type.");
    }
    if (!fullName) {
      return badRequest("Your name is required.");
    }
    if (!isEmail(email)) {
      return badRequest("Enter a valid email address.");
    }
    if (!region) {
      return badRequest("Your city or target region is required.");
    }
    if (!consent) {
      return badRequest("Please confirm that GoGymGo may contact you.");
    }

    if (audience === "gym_goer") {
      if (!workoutStyle) {
        return badRequest("Choose how you train.");
      }
      if (!Number.isInteger(goalDays) || goalDays < 1 || goalDays > 7) {
        return badRequest("Choose a Weekly Goal between 1 and 7 days.");
      }
    }

    if (audience === "brand") {
      if (!companyName) {
        return badRequest("Your company name is required.");
      }
      if (!partnershipInterest) {
        return badRequest("Choose a partnership interest.");
      }
      if (!isSafeWebsite(website)) {
        return badRequest("Enter a valid company website.");
      }
    }

    await ensureInterestTable();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO interest_submissions (
        id, audience, email, full_name, company_name, website, region,
        goal_days, workout_style, partnership_interest, discovery_source,
        message, consent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (audience, email) DO UPDATE SET
        full_name = excluded.full_name,
        company_name = excluded.company_name,
        website = excluded.website,
        region = excluded.region,
        goal_days = excluded.goal_days,
        workout_style = excluded.workout_style,
        partnership_interest = excluded.partnership_interest,
        discovery_source = excluded.discovery_source,
        message = excluded.message,
        consent = excluded.consent,
        updated_at = excluded.updated_at
    `)
      .bind(
        id,
        audience,
        email,
        fullName,
        companyName || null,
        website || null,
        region,
        audience === "gym_goer" ? goalDays : null,
        workoutStyle || null,
        partnershipInterest || null,
        discoverySource || null,
        message || null,
        1,
        now,
        now,
      )
      .run();

    return Response.json({ saved: true }, { status: 201 });
  } catch {
    return Response.json(
      { error: "We couldn’t save your information. Please try again." },
      { status: 500 },
    );
  }
}
