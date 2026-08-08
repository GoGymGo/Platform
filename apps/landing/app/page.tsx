import Link from "next/link";
import { getSeptemberCampaignState, septemberCampaign } from "./campaign";
import { AppLink } from "./components/AppLink";
import { ProductScreens } from "./components/ProductScreens";
import { siteLinks } from "./site-links";

const journeySteps = [
  {
    number: "01",
    title: "Choose your Weekly Goal",
    copy: `Commit to ${septemberCampaign.weeklyGoalRange} per scoring week so every Verified workout has a clear purpose.`,
  },
  {
    number: "02",
    title: "Verify the workout",
    copy: `Scan an active poster at a Partner gym when you arrive and again after at least ${septemberCampaign.minimumSessionMinutes} minutes.`,
  },
  {
    number: "03",
    title: "Build competition progress",
    copy: "Verified workouts count toward your Weekly Goal and published Competition results—without presenting pending activity as credit.",
  },
];

const readinessFacts = [
  {
    title: "NO PURCHASE REQUIRED",
    copy: "Joining is free. Age, location, current competition availability, and access to an active poster at a Partner gym still apply.",
  },
  {
    title: "VERIFICATION BEFORE CREDIT",
    copy: `Entry and exit scans, fresh location readings, and the ${septemberCampaign.minimumSessionMinutes}+ minute minimum are reviewed before a workout counts.`,
  },
  {
    title: "CHECK CURRENT GYM STATUS",
    copy: "A public Partner gym directory is not available. The member app confirms whether a GoGymGo poster currently qualifies.",
  },
] as const;

const transparencyFacts = [
  {
    title: "ONE DISCLOSED REWARD",
    copy: `The September pilot has one ${septemberCampaign.reward} reward sponsored by ${septemberCampaign.rewardSponsor}. No outside brand sponsors the current reward.`,
  },
  {
    title: "NO PURCHASE REQUIRED",
    copy: "Joining is free. Age, location, published legal terms, Competition availability, and approved Partner gym access still apply.",
  },
  {
    title: "VERIFICATION BEFORE CREDIT",
    copy: `A workout stays pending until the submitted entry scan, exit scan, fresh location readings, and ${septemberCampaign.minimumSessionMinutes}+ minute minimum are reviewed.`,
  },
  {
    title: "CURRENT GYM STATUS",
    copy: "A public Partner gym directory is not published. The member app is authoritative for active GoGymGo posters and current availability.",
  },
] as const;

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    logo: "https://gogymgo.com/mark.svg",
    name: "GoGymGo",
    url: "https://gogymgo.com",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description:
      "Free September 2026 beta for eligible gym-goers age 19+ on Vancouver Island and the supported Gulf Islands.",
    name: "GoGymGo",
    url: "https://gogymgo.com",
  },
];

function SeptemberCompetitionPanel() {
  return (
    <aside
      aria-label="September 2026 beta competition details"
      className="pilot-console"
    >
      <div className="pilot-console__header">
        <span>COMPETITION SNAPSHOT</span>
      </div>
      <div className="pilot-console__reward">
        <span>ONE PUBLISHED REWARD</span>
        <strong>{septemberCampaign.reward}</strong>
        <p>Sponsored by {septemberCampaign.rewardSponsor}</p>
      </div>
      <div className="pilot-console__window">
        <span>COMPETITION WINDOW</span>
        <strong>{septemberCampaign.compactWindow}</strong>
        <p>{septemberCampaign.timeWindow}</p>
      </div>
      <dl className="pilot-console__facts">
        <div>
          <dt>ELIGIBLE REGION</dt>
          <dd>{septemberCampaign.regionName}</dd>
        </div>
        <div>
          <dt>MINIMUM AGE</dt>
          <dd>{septemberCampaign.minimumAge}+</dd>
        </div>
        <div>
          <dt>WEEKLY GOAL</dt>
          <dd>{septemberCampaign.weeklyGoalRange}</dd>
        </div>
        <div>
          <dt>VERIFIED WORKOUT</dt>
          <dd>{septemberCampaign.minimumSessionMinutes}+ minutes</dd>
        </div>
      </dl>
      <p className="pilot-console__note">
        Live availability, eligibility, and Partner gym status are confirmed in
        the app before enrollment.
      </p>
    </aside>
  );
}

export default function Home() {
  const campaignState = getSeptemberCampaignState();
  const memberRegistrationAvailable =
    campaignState.primaryAction === "memberApp";

  return (
    <main className="landing-page">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />

      <section className="landing-hero shell">
        <div className="hero-copy">
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
            Make consistency <span>count.</span>
          </h1>
          <p className="hero-lede">
            {campaignState.phase === "ended" ? (
              <>
                Build verified competition progress from weekly workouts. The
                September 2026 beta has ended, but Regional updates remain open.
              </>
            ) : (
              <>
                Set a Weekly Goal, verify workouts at a Partner gym, and build
                competition progress.
              </>
            )}
          </p>

          <div className="hero-actions">
            {memberRegistrationAvailable ? (
              <AppLink
                analyticsEvent="member_app_click"
                className="button button-primary"
                href={siteLinks.memberApp}
              >
                {campaignState.primaryLabel}
              </AppLink>
            ) : (
              <Link
                className="button button-primary"
                data-analytics-event="regional_updates_click"
                href={siteLinks.regionalUpdates}
              >
                GET REGIONAL UPDATES <span aria-hidden="true">→</span>
              </Link>
            )}
            {memberRegistrationAvailable ? (
              <Link
                className="hero-fallback-link"
                data-analytics-event="regional_updates_click"
                href={siteLinks.regionalUpdates}
              >
                GET REGIONAL UPDATES <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <Link className="button button-secondary" href={siteLinks.faq}>
                REVIEW SEPTEMBER DETAILS <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <p className="hero-trust-signal">
            <span aria-hidden="true">✓</span>
            <strong>VERIFIED BEFORE CREDIT</strong>
            Verified workouts at Partner gyms count only after review.
          </p>
        </div>
            <SeptemberCompetitionPanel />
      </section>

      <section className="section shell" id="joining-and-verification">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HOW GOGYMGO WORKS</p>
            <h2>Three steps from intention to verified progress.</h2>
          </div>
          <p>
            The member app keeps your goal, session verification, and published
            results in one clear flow.
          </p>
        </div>
        <div className="steps-grid landing-steps">
          {journeySteps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
        <div className="joining-readiness" id="before-you-join">
          <div className="joining-readiness__heading">
            <p className="eyebrow">BEFORE YOU JOIN</p>
            <h3>Three things to know before you start.</h3>
          </div>
          <div className="joining-readiness__grid">
            {readinessFacts.map((fact) => (
              <article key={fact.title}>
                <strong>{fact.title}</strong>
                <p>{fact.copy}</p>
              </article>
            ))}
          </div>
          <div className="transparency-actions">
            <AppLink
              className="button button-secondary"
              href={siteLinks.officialRules}
            >
              READ OFFICIAL CONTEST RULES
            </AppLink>
            <AppLink className="text-link" href={siteLinks.privacy}>
              REVIEW THE PRIVACY POLICY
            </AppLink>
          </div>
        </div>
      </section>

      <ProductScreens />

      <section className="section transparency-section" id="pilot-transparency">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PILOT TRANSPARENCY // PUBLISHED FACTS</p>
              <h2>Clear rules without crowding the experience.</h2>
            </div>
            <p>
              Review the published pilot facts when you need them. The member
              app remains authoritative for live availability and eligibility.
            </p>
          </div>
          <details className="campaign-details">
            <summary>
              <span>REVIEW SEPTEMBER PILOT FACTS</span>
              <b>4 FACTS + OFFICIAL LINKS</b>
            </summary>
            <div className="transparency-grid">
              {transparencyFacts.map((fact) => (
                <article className="transparency-card" key={fact.title}>
                  <h3>{fact.title}</h3>
                  <p>{fact.copy}</p>
                </article>
              ))}
            </div>
            <div className="transparency-actions">
              <AppLink
                className="button button-secondary"
                href={siteLinks.officialRules}
              >
                READ OFFICIAL CONTEST RULES
              </AppLink>
              <AppLink className="text-link" href={siteLinks.privacy}>
                REVIEW THE PRIVACY POLICY
              </AppLink>
            </div>
          </details>
        </div>
      </section>

      <section className="section conversion-section">
        <div className="shell conversion-grid">
          <div className="conversion-primary">
            <div>
              <p className="eyebrow">YOUR NEXT WORKOUT CAN COUNT</p>
              <h2>Ready to turn consistency into verified progress?</h2>
              <p>
                Join in the member app, or get Regional updates if the current
                pilot is not available where you train.
              </p>
            </div>
            <div className="final-actions">
              {memberRegistrationAvailable ? (
                <AppLink
                  analyticsEvent="member_app_click"
                  className="button button-primary"
                  href={siteLinks.memberApp}
                >
                  {campaignState.primaryLabel}
                </AppLink>
              ) : null}
              <Link
                className={
                  memberRegistrationAvailable
                    ? "button button-secondary"
                    : "button button-primary"
                }
                data-analytics-event="regional_updates_click"
                href={siteLinks.regionalUpdates}
              >
                OUTSIDE THE PILOT REGION? GET REGIONAL UPDATES{" "}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
          <aside className="conversion-partner">
            <p className="eyebrow eyebrow-pink">FOR FITNESS BRANDS</p>
            <h3>Support the habit. Reward the effort.</h3>
            <p>
              Help fund future approved regional campaigns with real product or
              coupon inventory after operator review.
            </p>
            <Link
              className="text-link text-link-pink"
              data-analytics-event="brand_partnership_click"
              href={siteLinks.brands}
            >
              EXPLORE A FOUNDING PARTNERSHIP <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
