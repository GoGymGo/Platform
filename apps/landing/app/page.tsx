import Link from "next/link";
import { getSeptemberCampaignState, septemberCampaign } from "./campaign";
import { AppLink } from "./components/AppLink";
import { ProductScreens } from "./components/ProductScreens";
import { siteLinks } from "./site-links";

const scoringSteps = [
  {
    number: "01",
    title: "Verify visits",
    copy: `One approved workout per regional calendar day adds ${septemberCampaign.goalScorePerVerifiedDay} point to Goal Score.`,
  },
  {
    number: "02",
    title: "Complete your goal",
    copy: "Meet your chosen Weekly Goal to bank that week’s Prize Draw Entries. A higher completed goal earns more base entries.",
  },
  {
    number: "03",
    title: "Multiply your month",
    copy: `Meet your goal in all ${septemberCampaign.scoringWeekCount} scoring weeks to unlock a ${septemberCampaign.perfectMonthMultiplier}× Perfect Month multiplier on eligible entries after settlement.`,
  },
] as const;

const journeySteps = [
  {
    number: "01",
    title: "Confirm the basics",
    copy: `Check the ${septemberCampaign.minimumAge}+ age, regional, and active partner-poster requirements before registration.`,
  },
  {
    number: "02",
    title: "Choose a Weekly Goal",
    copy: `Commit to ${septemberCampaign.weeklyGoalRange} per scoring week. Your choice stays fixed for the September competition.`,
  },
  {
    number: "03",
    title: "Verify each workout",
    copy: `Scan the same active poster on entry and after at least ${septemberCampaign.minimumSessionMinutes} minutes. Submitted evidence is reviewed before credit.`,
  },
] as const;

const readinessFacts = [
  {
    title: "NO PURCHASE REQUIRED",
    copy: "Joining is free. Age, location, current competition availability, and active partner-poster access still apply.",
  },
  {
    title: "VERIFICATION BEFORE CREDIT",
    copy: `Only one approved workout per regional calendar day counts. Entry and exit scans, fresh location readings, and the ${septemberCampaign.minimumSessionMinutes}+ minute minimum are reviewed first.`,
  },
  {
    title: "CHECK CURRENT GYM STATUS",
    copy: "A public partner-gym directory is not available. Look for an active GoGymGo poster; the app confirms whether it currently qualifies.",
  },
] as const;

const gymOwnerBenefits = [
  {
    number: "01",
    title: "Give members one clear flow",
    copy: "An active partner poster supports the same entry and exit scan process on every eligible visit.",
  },
  {
    number: "02",
    title: "Keep verification off the front desk",
    copy: "Members follow the workout timer, location prompts, and evidence steps in the app on their own device.",
  },
  {
    number: "03",
    title: "Create another reason to return",
    copy: "Weekly goals and monthly competitions reinforce consistent visits without changing your core membership offering.",
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
      <div className="pilot-console__summary">
        <div className="pilot-console__reward">
          <span>ONE REWARD</span>
          <strong>{septemberCampaign.reward}</strong>
          <p>Sponsored by {septemberCampaign.rewardSponsor}</p>
        </div>
        <div className="pilot-console__window">
          <span>COMPETITION WINDOW</span>
          <strong>{septemberCampaign.compactWindow}</strong>
          <p>{septemberCampaign.scoringWeekCount} scoring weeks</p>
        </div>
      </div>
      <dl className="pilot-console__facts">
        <div>
          <dt>WEEKLY GOAL</dt>
          <dd>{septemberCampaign.weeklyGoalRange}</dd>
        </div>
        <div>
          <dt>MINIMUM AGE</dt>
          <dd>{septemberCampaign.minimumAge}+</dd>
        </div>
        <div>
          <dt>VERIFIED WORKOUT</dt>
          <dd>{septemberCampaign.minimumSessionMinutes}+ minutes</dd>
        </div>
        <div>
          <dt>PERFECT MONTH</dt>
          <dd>{septemberCampaign.perfectMonthMultiplier}× eligible entries</dd>
        </div>
      </dl>
      <div className="pilot-console__footer">
        <span>NO PURCHASE REQUIRED // ACTIVE PARTNER POSTER REQUIRED</span>
        <AppLink href={siteLinks.officialRules}>OFFICIAL RULES</AppLink>
      </div>
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
                The September 2026 beta has ended. Review how the month worked
                or request updates about future availability in your region.
              </>
            ) : (
              <>
                Choose a Weekly Goal of {septemberCampaign.weeklyGoalRange} and
                compete across {septemberCampaign.scoringWeekCount} September
                scoring weeks. Every approved gym day builds Goal Score;
                completed weekly goals bank Prize Draw Entries.
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
                GET FUTURE-REGION UPDATES <span aria-hidden="true">→</span>
              </Link>
            )}
            {memberRegistrationAvailable ? (
              <Link
                className="button button-secondary"
                data-analytics-event="regional_updates_click"
                href={siteLinks.regionalUpdates}
              >
                GET FUTURE-REGION UPDATES <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <Link className="button button-secondary" href={siteLinks.faq}>
                REVIEW SEPTEMBER DETAILS <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <p className="hero-action-note">
            {memberRegistrationAvailable
              ? "Registration and competition entry continue in the member app. Regional updates do not create an app account."
              : "Regional updates do not create an app account or competition entry."}
          </p>
        </div>
        <SeptemberChallengePanel statusLabel={campaignState.statusLabel} />

        <div className="hero-scoring">
          <div className="hero-scoring__heading">
            <div>
              <p className="eyebrow">HOW COMPETITION SCORING WORKS</p>
              <h2>From verified visit to monthly multiplier.</h2>
            </div>
            <p>
              Goal Score tracks approved gym days. Prize Draw Entries are
              banked only after you complete the Weekly Goal you selected.
            </p>
          </div>
          <div className="scoring-explainer">
            <ol>
              {scoringSteps.map((step) => (
                <li key={step.number}>
                  <span>{step.number}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="scoring-explainer__note">
              Miss a Weekly Goal and that week settles at zero Prize Draw
              Entries. Entries improve relative odds but never guarantee the
              reward. The published{" "}
              <AppLink href={siteLinks.officialRules}>
                Official Contest Rules
              </AppLink>{" "}
              control if a summary differs.
            </p>
          </div>
        </div>
      </section>

      <section className="section gym-owner-section" id="gym-partners">
        <div className="shell">
          <div className="section-heading gym-owner-heading">
            <div>
              <p className="eyebrow eyebrow-pink">FOR GYM OWNERS</p>
              <h2>Make verified visits easier to support.</h2>
            </div>
            <p>
              GoGymGo gives eligible members a repeatable app-guided visit
              flow, while your team provides the active partner poster and the
              gym experience you already run.
            </p>
          </div>

          <div className="gym-owner-grid">
            {gymOwnerBenefits.map((benefit) => (
              <article className="gym-owner-benefit" key={benefit.number}>
                <span>{benefit.number}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.copy}</p>
              </article>
            ))}

            <aside className="gym-owner-cta">
              <p>PARTNER GYM INTAKE</p>
              <h3>Bring GoGymGo to your gym.</h3>
              <span>
                Tell us about your location and operating setup. A submission
                requests a partnership review; it does not activate a gym
                immediately.
              </span>
              <Link
                className="button button-pink"
                data-analytics-event="brand_partnership_click"
                href={siteLinks.partnerApplication}
              >
                BECOME A PARTNER GYM <span aria-hidden="true">→</span>
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <section className="section shell" id="how-it-works">
        <div className="section-heading">
          <div>
            <p className="eyebrow">JOINING &amp; VERIFICATION</p>
            <h2>From signup to an approved gym day.</h2>
          </div>
          <p>
            Registration happens in the app. The landing-page update list does
            not create an account or competition entry.
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
      </section>

      <section className="section transparency-section" id="pilot-transparency">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BEFORE YOU JOIN</p>
              <h2>What to know before you start.</h2>
            </div>
            <p>
              These summaries explain the public September basics. The
              published Official Contest Rules control if a summary differs.
            </p>
          </div>
          <div className="transparency-grid">
            {readinessFacts.map((fact) => (
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

      <section className="section shell final-cta">
        <div>
          <p className="eyebrow">CHOOSE YOUR NEXT STEP</p>
          <h2>Choose your next step.</h2>
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
            GET FUTURE-REGION UPDATES <span aria-hidden="true">→</span>
          </Link>
          <Link
            className="button button-secondary"
            data-analytics-event="brand_partnership_click"
            href={siteLinks.partnerApplication}
          >
            PARTNER WITH GOGYMGO <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
