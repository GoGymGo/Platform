import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteFeedbackForm } from "../components/PublicSiteFeedbackForm";
import { siteLinks } from "../site-links";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  description:
    "Find the right GoGymGo contact path for regional launch updates, fitness brand partnerships, or member-app support.",
  title: "Contact",
};

const contactPaths = [
  {
    copy: "Join the free regional update list for launch and availability news. This does not register you for a competition.",
    href: `${siteLinks.gymGoers}#gym-form`,
    label: "OPEN REGIONAL UPDATE FORM",
    title: "Gym-goer updates",
  },
  {
    copy: "Tell us about the region, timing, inventory, and campaign model your fitness brand is exploring.",
    href: `${siteLinks.brands}#brand-form`,
    label: "OPEN PARTNERSHIP FORM",
    title: "Fitness brand partnerships",
  },
  {
    copy: "Account, eligibility, legal-document, workout, or competition support belongs inside the member experience where the relevant state is available.",
    href: siteLinks.memberApp,
    label: "OPEN THE MEMBER APP",
    title: "Existing member support",
  },
  {
    copy: "Report an accessibility barrier, broken public link, form problem, or readability issue without going through the member app.",
    href: siteLinks.publicSiteHelp,
    label: "REPORT A PUBLIC-SITE PROBLEM",
    title: "Public-site feedback",
  },
];

export default function ContactPage() {
  return (
    <main className="info-page">
      <div className="shell info-page__shell">
        <header className="info-page__header">
          <p className="eyebrow">CONTACT // ROUTED BY NEED</p>
          <h1>Start in the right place.</h1>
          <p>
            GoGymGo routes public requests through the relevant form so launch,
            partnership, and member questions do not end up in the wrong queue.
          </p>
        </header>

        <div className="contact-grid">
          {contactPaths.map((path) => (
            <article className="contact-card" key={path.title}>
              <h2>{path.title}</h2>
              <p>{path.copy}</p>
              <Link className="text-link" href={path.href}>
                {path.label} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>

        <section
          aria-labelledby="public-site-help-title"
          className="feedback-panel"
          id="public-site-help"
        >
          <div className="feedback-panel__intro">
            <p className="eyebrow">PUBLIC SITE // ACCESSIBILITY &amp; FEEDBACK</p>
            <h2 id="public-site-help-title">Tell us what blocked you.</h2>
            <p>
              Use this form for the public website only. Include the affected
              page and enough detail to reproduce the issue. Account,
              competition, and workout support remains inside the member app.
            </p>
          </div>
          <PublicSiteFeedbackForm />
        </section>
      </div>
    </main>
  );
}
