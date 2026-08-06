import Link from "next/link";
import { getSeptemberCampaignState, septemberCampaign } from "./campaign";
import { AppLink } from "./components/AppLink";
import { ProductScreens } from "./components/ProductScreens";
import { siteLinks } from "./site-links";

const steps = [
  {
    number: "01",
    title: "Choose your weekly goal",
    copy: `Commit to ${septemberCampaign.weeklyGoalRange} per scoring week so every verified workout has a clear purpose.`,
  },
  {
    number: "02",
    title: "Verify the workout",
    copy: `Scan an active partner-gym poster when you arrive and again after at least ${septemberCampaign.minimumSessionMinutes} minutes.`,
  },
  {
    number: "03",
    title: "Build competition progress",
    copy: "Approved sessions count toward your goal and published competition results—without presenting pending activity as credit.",
  },
];

const transparencyFacts = [
  {
    title: "ONE DISCLOSED REWARD",
    copy: `The September pilot has one ${septemberCampaign.reward} reward sponsored by ${septemberCampaign.rewardSponsor}. No outside brand sponsors the current reward.`,
  },
  {
    title: "NO PURCHASE REQUIRED",
    copy: "Joining is free. Age, location, published legal terms, competition availability, and approved partner-gym access still apply.",
  },
  {
    title: "VERIFICATION BEFORE CREDIT",
    copy: `A workout stays pending until the submitted entry scan, exit scan, fresh location readings, and ${septemberCampaign.minimumSessionMinutes}+ minute minimum are reviewed.`,
  },
  {
    title: "CURRENT GYM STATUS",
    copy: "A public partner-gym directory is not published. The member app is authoritative for active GoGymGo posters and current availability.",
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

function SeptemberChallengePanel({ statusLabel }: { statusLabel: string }) {
  return (
    <aside
      aria-label="September 2026 beta challenge details"
      className="pilot-console"
    >
      <div className="pilot-console__header">
        <span>SEPTEMBER 2026 BETA</span>
        <b>{statusLabel}</b>
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
          <dt>VERIFIED SESSION</dt>
          <dd>{septemberCampaign.minimumSessionMinutes}+ minutes</dd>
        </div>
      </dl>
      <p className="pilot-console__note">
        {septemberCampaign.registrationNote} The app also confirms location,
        published legal documents, and partner-gym eligibility before
        enrollment.
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
                Set a weekly gym goal, verify real workouts, and turn
                consistency into competition progress. The September 2026 beta
                has ended, but regional updates remain open.
              </>
            ) : (
              <>
                Set a weekly gym goal, verify real workouts at partner gyms, and
                turn consistency into competition progress.
              </>
            )}
          </p>
          {campaignState.phase !== "ended" ? (
            <p className="hero-campaign-note">
              The free September beta is open to eligible gym-goers age{" "}
              {septemberCampaign.minimumAge}+ on {septemberCampaign.regionName},
              with one {septemberCampaign.reward} reward sponsored by{" "}
              {septemberCampaign.rewardSponsor}.
            </p>
          ) : null}
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
                OUTSIDE THE PILOT REGION? GET REGIONAL UPDATES{" "}
                <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <Link className="button button-secondary" href={siteLinks.faq}>
                REVIEW SEPTEMBER DETAILS <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <p className="hero-action-note">
            {memberRegistrationAvailable
              ? "Registration and final eligibility checks happen in the member app. Regional updates do not create an account or competition entry."
              : "Regional updates do not create an app account or competition entry."}
          </p>
          <p className="hero-trust-signal">
            <span aria-hidden="true">✓</span>
            <strong>VERIFIED BEFORE CREDIT</strong>
            Workouts are checked at eligible partner gyms. Pending activity
            never appears as approved competition progress.
          </p>
          <ul aria-label="September beta essentials" className="hero-qualifiers">
            <li>FREE TO JOIN</li>
            <li>{septemberCampaign.minimumAge}+ PILOT</li>
            <li>{septemberCampaign.minimumSessionMinutes}+ MIN VERIFIED</li>
          </ul>
        </div>
        <SeptemberChallengePanel statusLabel={campaignState.statusLabel} />
      </section>

      <section className="section shell" id="how-it-works">
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
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
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
                Join in the member app, or get regional updates if the current
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
