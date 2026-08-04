import type { Metadata } from "next";
import Link from "next/link";
import { getSeptemberCampaignState, septemberCampaign } from "../campaign";
import { AppLink } from "../components/AppLink";
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
    copy: "Set a Weekly Goal that matches your routine. A higher completed goal earns more base Prize Draw Entries.",
  },
  {
    title: "BUILD GOAL SCORE",
    copy: "One approved partner-gym workout per regional calendar day adds 1 point to Goal Score.",
  },
  {
    title: "BANK WEEKLY ENTRIES",
    copy: "Complete your Weekly Goal to bank that week’s Prize Draw Entries. Miss it and the week settles at zero entries.",
  },
  {
    title: "COMPLETE ALL 4 WEEKS",
    copy: "Meet your goal in every scoring week to unlock the 10× Perfect Month multiplier on eligible entries. Entries improve odds but never guarantee the reward.",
  },
];

export default function GymGoersPage() {
  const campaignState = getSeptemberCampaignState();
  const memberRegistrationAvailable =
    campaignState.primaryAction === "memberApp";

  return (
    <main className="audience-page">
      <div className="shell audience-hero">
        <div className="audience-copy">
          <p className="eyebrow campaign-status">
            <span>SEPTEMBER 2026 BETA</span>
            <span
              className={`campaign-status__state campaign-status__state--${campaignState.phase}`}
            >
              <span className="status-dot" />
              {campaignState.statusLabel}
            </span>
          </p>
          <h1>
            Join now—or hear when your region is <span>next.</span>
          </h1>
          <p>
            {campaignState.phase === "ended" ? (
              <>
                The September 2026 beta has ended. Review the published pilot
                details and join the free regional update list for future
                availability.
              </>
            ) : (
              <>
                The September 2026 beta is limited to eligible gym-goers age{" "}
                {septemberCampaign.minimumAge}+ on {septemberCampaign.regionName}.
                If that is you, register in the app. Everywhere else, join the
                free regional update list below.
              </>
            )}
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
            {memberRegistrationAvailable ? (
              <>
                <AppLink
                  analyticsEvent="member_app_click"
                  className="button button-primary"
                  href={siteLinks.memberApp}
                >
                  {campaignState.primaryLabel}
                </AppLink>
                <Link
                  className="text-link"
                  data-analytics-event="regional_updates_click"
                  href="#gym-form"
                >
                  GET REGIONAL UPDATES <span aria-hidden="true">↓</span>
                </Link>
              </>
            ) : (
              <Link
                className="button button-primary"
                data-analytics-event="regional_updates_click"
                href="#gym-form"
              >
                GET REGIONAL UPDATES <span aria-hidden="true">↓</span>
              </Link>
            )}
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
          <p className="eyebrow">FROM VERIFIED DAY TO PRIZE DRAW ENTRIES</p>
          <h2 id="gym-details-title">Know what each visit earns.</h2>
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
