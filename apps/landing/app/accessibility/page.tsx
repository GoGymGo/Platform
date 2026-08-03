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
            <h2>Report a barrier</h2>
            <p>
              If something prevents you from reading, navigating, or completing
              a public form, use the relevant route on our contact page and
              include the page, device, browser, and problem you encountered.
            </p>
            <Link className="button button-secondary" href={siteLinks.contact}>
              GO TO CONTACT OPTIONS →
            </Link>
          </section>
          <p className="fine-print">Last updated August 3, 2026.</p>
        </div>
      </div>
    </main>
  );
}
