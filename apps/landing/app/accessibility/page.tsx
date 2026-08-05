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
            We target WCAG 2.2 Level AA for the public GoGymGo website and test
            common journeys with keyboards, screen readers, browser zoom,
            reduced motion, and mobile and desktop layouts.
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
            <h2>Accessibility target and known limitations</h2>
            <p>
              WCAG 2.2 Level AA is our current target, not a formal conformance
              claim. This statement covers the public marketing site only. The
              member app, demo, and app-hosted legal pages are separate
              experiences with their own interaction and device requirements.
              Please report any difficulty with display type, focus order,
              motion, navigation, or form feedback.
            </p>
          </section>
          <section>
            <h2>Privacy-conscious public-site measurement</h2>
            <p>
              To find confusing public journeys, this site counts a fixed list
              of interactions such as app-link clicks, FAQ opens, and the first
              use of a public form. These measurement events contain only the
              event name, public page path, and time. They do not store cookies,
              identifiers, form values, precise location, or member-app
              activity.
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
          <p className="fine-print">Last reviewed August 4, 2026.</p>
        </div>
      </div>
    </main>
  );
}
