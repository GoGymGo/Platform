export const publicSiteEventNames = [
  "member_app_click",
  "regional_updates_click",
  "brand_partnership_click",
  "demo_click",
  "faq_open",
  "gym_form_start",
  "brand_form_start",
  "feedback_form_start",
  "eligibility_check_completed",
] as const;

export type PublicSiteEventName = (typeof publicSiteEventNames)[number];

export function recordPublicSiteEvent(eventName: PublicSiteEventName) {
  if (typeof window === "undefined") {
    return;
  }

  void fetch("/api/public-site-events", {
    body: JSON.stringify({ eventName, path: window.location.pathname }),
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Measurement is best-effort and must never interrupt the visitor journey.
  });
}
