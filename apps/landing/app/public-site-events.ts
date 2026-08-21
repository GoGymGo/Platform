export const publicSiteEventDefinitions = {
  brand_form_start: { canonicalPath: "/brands" },
  brand_partnership_click: { canonicalPath: "/partners" },
  demo_click: { canonicalPath: "/demo" },
  faq_open: { canonicalPath: "/faq" },
  feedback_form_start: { canonicalPath: "/contact" },
  gym_form_start: { canonicalPath: "/gym-goers" },
  member_app_click: { canonicalPath: "/join" },
  regional_updates_click: { canonicalPath: "/gym-goers" },
} as const;

export type PublicSiteEventName = keyof typeof publicSiteEventDefinitions;

export const publicSiteEventNames = Object.freeze(
  Object.keys(publicSiteEventDefinitions) as PublicSiteEventName[],
);

export function recordPublicSiteEvent(eventName: PublicSiteEventName) {
  if (typeof window === "undefined") {
    return;
  }

  void fetch("/api/public-site-events", {
    body: JSON.stringify({ eventName }),
    credentials: "omit",
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
    referrerPolicy: "no-referrer",
  }).catch(() => {
    // Measurement is best-effort and must never interrupt the visitor journey.
  });
}
