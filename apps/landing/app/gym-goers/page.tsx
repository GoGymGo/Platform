import type { Metadata } from "next";
import Link from "next/link";
import { septemberCampaign } from "../campaign";
import { GymGoerForm } from "../components/InterestForms";
import { siteLinks } from "../site-links";

export const metadata: Metadata = {
  alternates: { canonical: "/gym-goers" },
  description:
    "Register for the eligible September GoGymGo beta or join the regional update list for future verified workout competitions.",
  title: "Gym-goer registration and regional updates",
};

const points = [
  {
    title: "CHOOSE 1–7 DAYS",
    copy: "Set a Weekly Goal that matches your real routine. Your competition goal is locked after enrollment.",
  },
  {
    title: "SCAN AT A PARTNER GYM",
    copy: "Scan an approved gym poster on entry with a fresh eligible location reading.",
  },
  {
    title: "TRAIN FOR 30+ MINUTES",
    copy: "Scan the same poster again after the authoritative 30-minute minimum to submit the workout for review.",
  },
  {
    title: "FOLLOW THE RESULT",
    copy: "The app keeps pending review, verified credit, standings, and published results clearly separated.",
  },
];

export default function GymGoersPage() {
  return (
    <main className="audience-page">
      <div className="shell audience-hero">
        <div className="audience-copy">
          <p className="eyebrow campaign-status">
            <span>SEPTEMBER 2026 BETA</span>
            <span className="campaign-status__state">
              <span className="status-dot" />
              {septemberCampaign.registrationLabel}
            </span>
          </p>
          <h1>
            Join now—or hear when your region is <span>next.</span>
          </h1>
          <p>
            The September 2026 beta is limited to eligible gym-goers age{" "}
            {septemberCampaign.minimumAge}+ on {septemberCampaign.regionName}.
            If that is you, register in the app. Everywhere else, join the free
            regional update list below.
          </p>
          <dl className="audience-summary">
            <div>
              <dt>COMPETITION WINDOW</dt>
              <dd>{septemberCampaign.displayWindow}</dd>
            </div>
            <div>
              <dt>REGISTRATION STATUS</dt>
              <dd>The app confirms current availability</dd>
            </div>
          </dl>
          <div className="audience-actions">
            <Link className="button button-primary" href={siteLinks.memberApp}>
              JOIN SEPTEMBER BETA <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" href="#gym-form">
              GET REGIONAL UPDATES <span aria-hidden="true">↓</span>
            </Link>
          </div>
        </div>

        <section
          aria-labelledby="gym-form-title"
          className="form-card"
          id="gym-form"
        >
          <div className="form-card-header">
            <span>REGIONAL UPDATE LIST // FREE</span>
            <h2 id="gym-form-title">Get updates for your region</h2>
            <p>
              Enter your email and region. This does not create an app account
              or register you for the September beta.
            </p>
            <small>Fields marked * are required.</small>
          </div>
          <GymGoerForm />
        </section>

        <section
          aria-labelledby="gym-details-title"
          className="audience-details"
        >
          <p className="eyebrow">WHAT A VERIFIED WORKOUT INVOLVES</p>
          <h2 id="gym-details-title">A clear path from goal to result.</h2>
          <div className="audience-points">
            {points.map((point) => (
              <article className="audience-point" key={point.title}>
                <strong>{point.title}</strong>
                <span>{point.copy}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
