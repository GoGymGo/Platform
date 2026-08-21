export const feedbackCategories = [
  "accessibility",
  "broken_link",
  "form_problem",
  "readability",
  "other",
] as const;

export type FeedbackCategory = (typeof feedbackCategories)[number];

export const feedbackPagePaths = {
  accessibility: "/accessibility",
  account_deletion: "/account-deletion",
  brands: "/brands",
  contact: "/contact",
  faq: "/faq",
  gym_goers: "/gym-goers",
  home: "/",
  other: "other",
  partners: "/partners",
} as const;

export type FeedbackPage = keyof typeof feedbackPagePaths;

export const publicSiteRetentionBounds = {
  events: { maximumDays: 90, minimumDays: 7 },
  feedback: { maximumDays: 180, minimumDays: 30 },
} as const;

export type PublicSiteRetentionPolicy = {
  eventDays: number;
  feedbackDays: number;
};

export function readPublicSiteRetentionPolicy(
  values: Record<string, string | undefined>,
): PublicSiteRetentionPolicy | null {
  const feedbackDays = readBoundedInteger(
    values.PUBLIC_SITE_FEEDBACK_RETENTION_DAYS,
    publicSiteRetentionBounds.feedback.minimumDays,
    publicSiteRetentionBounds.feedback.maximumDays,
  );
  const eventDays = readBoundedInteger(
    values.PUBLIC_SITE_EVENT_RETENTION_DAYS,
    publicSiteRetentionBounds.events.minimumDays,
    publicSiteRetentionBounds.events.maximumDays,
  );

  return feedbackDays === null || eventDays === null
    ? null
    : { eventDays, feedbackDays };
}

function readBoundedInteger(
  value: string | undefined,
  minimum: number,
  maximum: number,
): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}
