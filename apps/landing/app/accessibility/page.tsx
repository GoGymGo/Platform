import type { Metadata } from "next";
import Link from "next/link";
import { siteLinks } from "../site-links";

export const metadata: Metadata = {
  alternates: { canonical: "/accessibility" },
  description:
    "GoGymGo’s public-site accessibility approach, current features, and route for reporting an accessibility barrier.",
  title: "Accessibility",
};

export default function AccessibilityPage() {
  return (
    <main className="info-page">
      <div className="shell info-page__shell info-page__shell--narrow">
        <header className="info-page__header">
          <p className="eyebrow">ACCESSIBILITY // PUBLIC SITE</p>
          <h1>GoGymGo should be understandable and usable.</h1>
          <p>
            We are working to make the public GoGymGo experience usable with
            keyboards, screen readers, browser zoom, reduced motion, and common
            mobile and desktop layouts.
          </p>
        </header>

        <div className="prose-stack">
          <section>
            <h2>What this site currently supports</h2>
            <ul>
              <li>Semantic headings, landmarks, labels, and status messages.</li>
              <li>A keyboard-visible skip link and focus styles.</li>
              <li>Touch targets sized for mobile use.</li>
              <li>Reduced-motion preferences.</li>
              <li>Responsive layouts without required horizontal scrolling.</li>
            </ul>
          </section>
          <section>
            <h2>Ongoing improvement</h2>
            <p>
              Accessibility is reviewed as content, forms, regional rules, and
              product journeys change. This statement describes the public
              marketing site; the member app has its own interaction and device
              requirements.
            </p>
          </section>
          <section>
            <h2>Privacy-conscious public-site measurement</h2>
            <p>
              To find confusing public journeys, this site counts a fixed list
              of interactions such as app-link clicks, FAQ opens, and the first
              use of a public form. The browser sends only the allowlisted event
              name; the server adds its fixed canonical action and time. Events
              are deleted after the approved period and never kept longer than
              90 days. They do not store cookies, identifiers, query strings,
              referrers, network addresses, device details, eligibility-check
              answers, form values, precise location, or member-app activity.
            </p>
          </section>
          <section>
            <h2>Report a barrier</h2>
            <p>
              If something prevents you from reading, navigating, or completing
              a public form, send a public-site report with the page, device,
              browser, and problem you encountered. You do not need a member
              account to report a barrier.
            </p>
            <Link
              className="button button-secondary"
              href={siteLinks.publicSiteHelp}
            >
              REPORT AN ACCESSIBILITY BARRIER →
            </Link>
          </section>
          <p className="fine-print">Last updated August 21, 2026.</p>
        </div>
      </div>
    </main>
  );
}
