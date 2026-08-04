import type { Metadata } from "next";
import Link from "next/link";
import { getSeptemberCampaignState, septemberCampaign } from "../campaign";
import { AppLink } from "../components/AppLink";
import { siteLinks } from "../site-links";

export const metadata: Metadata = {
  alternates: { canonical: "/faq" },
  description:
    "Answers about GoGymGo September beta eligibility, regional updates, Weekly Goals, verified workouts, rewards, and brand partnerships.",
  title: "Frequently asked questions",
};

const questions = [
  {
    answer: (
      <p>
        Eligible gym-goers must be age {septemberCampaign.minimumAge}+ and
        located within {septemberCampaign.regionName}. The app confirms location,
        current legal documents, competition availability, and other enrollment
        requirements before registration succeeds.
      </p>
    ),
    question: "Who can join the September 2026 beta?",
  },
  {
    answer: (
      <>
        <p>The included Gulf Islands are:</p>
        <ul className="faq-inline-list">
          {septemberCampaign.supportedIslands.map((island) => (
            <li key={island}>{island}</li>
          ))}
        </ul>
        <p>
          Bowen Island, the Gambier Island Local Trust Area, mainland British
          Columbia, and locations outside Canada are not included in this pilot.
        </p>
      </>
    ),
    question: "Which Gulf Islands are included?",
  },
  {
    answer: (
      <p>
        The competition runs from {septemberCampaign.competitionWindow}.
        Registration opens when the competition is published and can remain
        available until the competition ends, reaches an entrant cap, or is
        cancelled. The app shows the authoritative current status.
      </p>
    ),
    question: "When does the beta run, and when can registration close?",
  },
  {
    answer: (
      <p>
        No. The regional update list only gives GoGymGo permission to email you
        about availability. September competition registration happens inside
        the member app.
      </p>
    ),
    question: "Does joining the update list register me for the beta?",
  },
  {
    answer: (
      <p>
        Joining is free and no purchase is required. Eligibility, regional
        rules, published competition terms, and approved partner-gym access
        still apply. Read the{" "}
        <AppLink href={siteLinks.officialRules}>Official Contest Rules</AppLink>{" "}
        before joining.
      </p>
    ),
    question: "Does GoGymGo cost money to join?",
  },
  {
    answer: (
      <p>
        Only a gym displaying an active GoGymGo partner poster can support this
        verification flow. The member app is authoritative for current partner
        availability. A scan at an ordinary gym or from an inactive poster does
        not qualify.
      </p>
    ),
    question: "Which gyms count as approved partner gyms?",
  },
  {
    answer: (
      <p>
        At an approved partner gym, scan the gym’s active poster on entry with a
        fresh eligible location reading. After at least 30 minutes, scan the
        same poster again. The server reviews the submitted evidence before
        awarding verified credit.
      </p>
    ),
    question: "How is a workout verified?",
  },
  {
    answer: (
      <p>
        Your Weekly Goal is the number of verified workout days you commit to in
        each scoring week. September participants choose from{" "}
        {septemberCampaign.weeklyGoalRange}, and the selection is locked after
        enrollment.
      </p>
    ),
    question: "What is a Weekly Goal?",
  },
  {
    answer: (
      <p>
        The September pilot has one {septemberCampaign.reward} cash reward
        sponsored by {septemberCampaign.rewardSponsor}. Verified activity can
        affect Prize Draw Entry weight, but category
        placement never guarantees the reward. An audited draw determines the
        reward winner after results settle. The published{" "}
        <AppLink href={siteLinks.officialRules}>Official Contest Rules</AppLink>{" "}
        control
        if any summary differs.
      </p>
    ),
    question: "What can September participants win?",
  },
  {
    answer: (
      <p>
        Future approved campaigns may include physical products or coupon
        inventory supplied by fitness brands. Campaign region, timing,
        inventory, fulfillment, disclosures, and reporting scope are reviewed
        before publication.
      </p>
    ),
    question: "How can a fitness brand participate?",
  },
];

const faqGroups = [
  {
    id: "joining",
    label: "JOINING & ELIGIBILITY",
    questions: questions.slice(0, 5),
  },
  {
    id: "workouts",
    label: "WORKOUTS & WEEKLY GOALS",
    questions: questions.slice(5, 8),
  },
  {
    id: "rewards",
    label: "REWARDS & PARTNERSHIPS",
    questions: questions.slice(8),
  },
] as const;

export default function FaqPage() {
  const campaignState = getSeptemberCampaignState();
  const memberRegistrationAvailable =
    campaignState.primaryAction === "memberApp";

  return (
    <main className="info-page">
      <div className="shell info-page__shell">
        <header className="info-page__header">
          <p className="eyebrow">CLEAR ANSWERS // BEFORE YOU JOIN</p>
          <h1>Frequently asked questions</h1>
          <p>
            Start here for the difference between September registration,
            regional updates, verified workouts, rewards, and partnerships.
          </p>
        </header>

        <nav aria-label="FAQ sections" className="faq-jump-nav">
          {faqGroups.map((group) => (
            <Link href={`#faq-${group.id}`} key={group.id}>
              {group.label}
            </Link>
          ))}
        </nav>

        <div className="faq-groups">
          {faqGroups.map((group) => (
            <section
              aria-labelledby={`faq-${group.id}`}
              className="faq-group"
              key={group.id}
            >
              <h2 className="faq-group-title" id={`faq-${group.id}`}>
                {group.label}
              </h2>
              <div className="faq-list">
                {group.questions.map((item) => (
                  <details className="faq-item" key={item.question}>
                    <summary>
                      <span>{item.question}</span>
                      <b aria-hidden="true">+</b>
                    </summary>
                    <div className="faq-answer">{item.answer}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="info-cta" aria-labelledby="faq-next-step">
          <div>
            <p className="eyebrow">READY FOR A NEXT STEP?</p>
            <h2 id="faq-next-step">Choose the path that matches you.</h2>
          </div>
          <div className="info-actions">
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
              GET REGIONAL UPDATES →
            </Link>
            <Link
              className="button button-secondary"
              data-analytics-event="brand_partnership_click"
              href={siteLinks.brands}
            >
              EXPLORE PARTNERSHIPS →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
