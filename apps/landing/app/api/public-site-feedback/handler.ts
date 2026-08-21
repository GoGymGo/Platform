import type {
  PublicSiteFeedbackRecord,
  PublicSiteStoreOutcome,
} from "@/app/api/public-site-storage";
import {
  hasExactKeys,
  methodNotAllowed,
  publicJsonError,
  publicNoStoreHeaders,
  readSameOriginJsonObject,
} from "@/app/api/public-site-request";
import {
  feedbackCategories,
  feedbackPagePaths,
  type FeedbackCategory,
  type FeedbackPage,
} from "@/app/public-site-policy";

const maximumFeedbackBodyBytes = 12_000;
const submissionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicSiteFeedbackHandlerDependencies = {
  store(feedback: PublicSiteFeedbackRecord): Promise<PublicSiteStoreOutcome>;
};

const feedbackKeys = [
  "category",
  "consent",
  "contactFax",
  "email",
  "message",
  "page",
  "submissionId",
] as const;

export async function handlePublicSiteFeedback(
  request: Request,
  dependencies: PublicSiteFeedbackHandlerDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed("POST");
  }

  const parsed = await readSameOriginJsonObject(
    request,
    maximumFeedbackBodyBytes,
  );
  if (!parsed.ok) {
    return parsed.response;
  }
  if (!hasExactKeys(parsed.value, feedbackKeys, feedbackKeys)) {
    return publicJsonError("Enter valid feedback details.", 400);
  }

  const contactFax = readBoundedString(parsed.value.contactFax, 200);
  if (contactFax === null) {
    return publicJsonError("Enter valid feedback details.", 400);
  }
  if (contactFax) {
    return savedResponse();
  }

  const submissionId = readBoundedString(parsed.value.submissionId, 36);
  const category = readBoundedString(parsed.value.category, 40);
  const page = readBoundedString(parsed.value.page, 40);
  const emailValue = readBoundedString(parsed.value.email, 320);
  const message = readBoundedString(parsed.value.message, 2_000);
  const consent = parsed.value.consent;

  if (!submissionId || !submissionIdPattern.test(submissionId)) {
    return publicJsonError("Start a new feedback submission and try again.", 400);
  }
  if (
    !category ||
    !feedbackCategories.includes(category as FeedbackCategory)
  ) {
    return publicJsonError("Choose the type of problem.", 400);
  }
  if (!page || !Object.hasOwn(feedbackPagePaths, page)) {
    return publicJsonError("Choose the public page with the problem.", 400);
  }
  if (message === null || message.length < 20) {
    return publicJsonError(
      "Describe the problem in 20 to 2,000 characters.",
      400,
    );
  }
  if (emailValue === null) {
    return publicJsonError("Enter a valid email address or leave it blank.", 400);
  }
  const email = emailValue.toLowerCase();
  if (email && !isValidEmail(email)) {
    return publicJsonError("Enter a valid email address or leave it blank.", 400);
  }
  if (typeof consent !== "boolean") {
    return publicJsonError("Enter valid contact permission.", 400);
  }
  if (email && !consent) {
    return publicJsonError(
      "Confirm that GoGymGo may use your email for this report.",
      400,
    );
  }
  if (!email && consent) {
    return publicJsonError(
      "Provide an email before granting contact permission.",
      400,
    );
  }

  try {
    const outcome = await dependencies.store({
      category: category as FeedbackCategory,
      consent,
      email,
      message,
      page: page as FeedbackPage,
      submissionId,
    });
    if (outcome === "rate_limited") {
      return publicJsonError(
        "We have received several reports. Please wait a minute and try again.",
        429,
        { "Retry-After": "60" },
      );
    }
    return savedResponse();
  } catch {
    return publicJsonError(
      "We couldn't save your report. Please try again shortly.",
      503,
    );
  }
}

function readBoundedString(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = value.trim();
  return cleaned.length <= maximumLength ? cleaned : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function savedResponse(): Response {
  return Response.json(
    { saved: true },
    { headers: publicNoStoreHeaders, status: 201 },
  );
}
