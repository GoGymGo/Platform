import Link from "next/link";
import { getSeptemberCampaignState, septemberCampaign } from "./campaign";
import { AppLink } from "./components/AppLink";
import { EligibilityCheck } from "./components/EligibilityCheck";
import { ProductScreens } from "./components/ProductScreens";
import { siteLinks } from "./site-links";

const steps = [
  {
    number: "01",
    title: "Confirm you are eligible",
    copy: `The September beta is for gym-goers age ${septemberCampaign.minimumAge}+ on ${septemberCampaign.regionName}. The app confirms region and current rules before enrollment.`,
  },
  {
    number: "02",
    title: "Choose a Weekly Goal",
    copy: `Commit to ${septemberCampaign.weeklyGoalRange} per scoring week. Your choice is locked for the September competition.`,
  },
  {
    number: "03",
    title: "Verify each workout",
    copy: `At an approved partner gym, scan the same poster on entry and after at least ${septemberCampaign.minimumSessionMinutes} minutes with a fresh location reading.`,
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
                The September 2026 beta has ended. Review how the pilot worked
                or request updates about future availability in your region.
              </>
            ) : (
              <>
                Eligible gym-goers age {septemberCampaign.minimumAge}+ on{" "}
                {septemberCampaign.regionName} can join the free September beta
                and compete for one {septemberCampaign.reward} reward sponsored
                by {septemberCampaign.rewardSponsor}.
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
                className="button button-secondary"
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
          <ul aria-label="Important eligibility notes" className="hero-qualifiers">
            <li>NO PURCHASE REQUIRED</li>
            <li>APPROVED PARTNER GYM REQUIRED</li>
            <li>REGIONAL RULES APPLY</li>
            <li>
              <AppLink href={siteLinks.officialRules}>
                READ OFFICIAL RULES
              </AppLink>
            </li>
          </ul>
        </div>
        <SeptemberChallengePanel statusLabel={campaignState.statusLabel} />
      </section>

      <section
        aria-label="September beta at a glance"
        className="proof-strip"
      >
        <div className="shell proof-grid">
          <div>
            <strong>19+</strong>
            <span>MINIMUM ELIGIBLE AGE</span>
          </div>
          <div>
            <strong>1–7</strong>
            <span>WEEKLY GOAL DAYS</span>
          </div>
          <div>
            <strong>{septemberCampaign.minimumSessionMinutes}+ MIN</strong>
            <span>VERIFIED MINIMUM</span>
          </div>
          <div>
            <strong>$0</strong>
            <span>ENTRY COST</span>
          </div>
        </div>
      </section>

      {campaignState.phase !== "ended" ? <EligibilityCheck /> : null}

      <section className="section shell" id="how-it-works">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HOW GOGYMGO WORKS</p>
            <h2>Three steps from eligibility to a verified workout.</h2>
          </div>
          <p>
            Registration and competition eligibility are confirmed in the app.
            Joining the regional update list does not register you for the beta.
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

      <section className="section transparency-section" id="pilot-transparency">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PILOT TRANSPARENCY // PUBLISHED FACTS</p>
              <h2>What is fixed—and what is confirmed in the app.</h2>
            </div>
            <p>
              These are the public September facts. The published Official
              Contest Rules control if a summary differs.
            </p>
          </div>
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
        </div>
      </section>

      <ProductScreens />

      <section className="section brand-section brand-teaser-section">
        <div className="shell brand-teaser">
          <div>
            <p className="eyebrow eyebrow-pink">FOR FITNESS BRANDS</p>
            <h2>Support the habit. Reward the effort.</h2>
          </div>
          <div className="brand-teaser__copy">
            <p>
              The September pilot reward is sponsored by GoGymGo. We are also
              preparing future, approved regional campaigns with fitness brands
              that can supply real product or coupon inventory.
            </p>
            <Link
              className="button button-pink"
              data-analytics-event="brand_partnership_click"
              href={siteLinks.brands}
            >
              EXPLORE A FOUNDING PARTNERSHIP <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section shell final-cta">
        <div>
          <p className="eyebrow">CHOOSE THE RIGHT NEXT STEP</p>
          <h2>Eligible now, waiting for your region, or representing a brand?</h2>
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
            GET REGIONAL UPDATES <span aria-hidden="true">→</span>
          </Link>
          <Link
            className="button button-secondary"
            data-analytics-event="brand_partnership_click"
            href={siteLinks.brands}
          >
            EXPLORE PARTNERSHIPS <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
