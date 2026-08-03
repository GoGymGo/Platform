import { getDb } from "@/db";
import { publicSiteFeedback } from "@/db/schema";

const feedbackCategories = [
  "accessibility",
  "broken_link",
  "form_problem",
  "readability",
  "other",
] as const;

type FeedbackCategory = (typeof feedbackCategories)[number];

type FeedbackPayload = {
  category?: unknown;
  consent?: unknown;
  contactFax?: unknown;
  email?: unknown;
  message?: unknown;
  page?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  let payload: FeedbackPayload;

  try {
    payload = (await request.json()) as FeedbackPayload;
  } catch {
    return Response.json({ error: "Enter valid feedback details." }, { status: 400 });
  }

  if (clean(payload.contactFax, 200)) {
    return Response.json({ saved: true }, { status: 201 });
  }

  const category = clean(payload.category, 40) as FeedbackCategory;
  const email = clean(payload.email, 320).toLowerCase();
  const message = clean(payload.message, 2_000);
  const page = clean(payload.page, 300);
  const consent = payload.consent === true;

  if (!feedbackCategories.includes(category)) {
    return Response.json({ error: "Choose the type of problem." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (page.length < 2) {
    return Response.json({ error: "Tell us which page has the problem." }, { status: 400 });
  }
  if (message.length < 20) {
    return Response.json(
      { error: "Describe the problem in at least 20 characters." },
      { status: 400 },
    );
  }
  if (!consent) {
    return Response.json(
      { error: "Please confirm that GoGymGo may contact you about this report." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  try {
    await getDb().insert(publicSiteFeedback).values({
      category,
      consent,
      createdAt: now,
      email,
      id: crypto.randomUUID(),
      message,
      page,
      status: "new",
      updatedAt: now,
    });
    return Response.json({ saved: true }, { status: 201 });
  } catch {
    return Response.json(
      { error: "We couldn't save your report. Please try again shortly." },
      { status: 503 },
    );
  }
}
