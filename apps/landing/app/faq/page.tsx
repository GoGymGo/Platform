import type { Metadata } from "next";
import Link from "next/link";
import { siteLinks } from "../site-links";

export const metadata: Metadata = {
  alternates: { canonical: "/faq" },
  description:
    "Answers about GoGymGo September beta eligibility, regional updates, Weekly Goals, verified workouts, rewards, and brand partnerships.",
  title: "Frequently asked questions",
};

const questions = [
  {
    answer:
      "Eligible gym-goers must be age 19+ and located on Vancouver Island or within the supported Gulf Islands region. The app confirms location, current legal documents, competition availability, and other enrollment requirements before registration succeeds.",
    question: "Who can join the September 2026 beta?",
  },
  {
    answer:
      "No. The regional update list only gives GoGymGo permission to email you about availability. September competition registration happens inside the member app.",
    question: "Does joining the update list register me for the beta?",
  },
  {
    answer:
      "Joining is free and no purchase is required. Eligibility, regional rules, published competition terms, and approved partner-gym access still apply.",
    question: "Does GoGymGo cost money to join?",
  },
  {
    answer:
      "At an approved partner gym, scan the gym’s active poster on entry with a fresh eligible location reading. After at least 30 minutes, scan the same poster again. The server reviews the submitted evidence before awarding verified credit.",
    question: "How is a workout verified?",
  },
  {
    answer:
      "Your Weekly Goal is the number of verified workout days you commit to in each scoring week. September participants choose from 1–7 days, and the selection is locked after enrollment.",
    question: "What is a Weekly Goal?",
  },
  {
    answer:
      "The September pilot is configured around one $100 CAD reward sponsored by GoGymGo. It must be published with current official rules before the competition can accept eligible enrollment.",
    question: "What can September participants win?",
  },
  {
    answer:
      "Future approved campaigns may include physical products or coupon inventory supplied by fitness brands. Campaign region, timing, inventory, fulfillment, disclosures, and reporting scope are reviewed before publication.",
    question: "How can a fitness brand participate?",
  },
];

export default function FaqPage() {
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

        <dl className="faq-list">
          {questions.map((item) => (
            <div className="faq-item" key={item.question}>
              <dt>{item.question}</dt>
              <dd>{item.answer}</dd>
            </div>
          ))}
        </dl>

        <section className="info-cta" aria-labelledby="faq-next-step">
          <div>
            <p className="eyebrow">READY FOR A NEXT STEP?</p>
            <h2 id="faq-next-step">Choose the path that matches you.</h2>
          </div>
          <div className="info-actions">
            <Link className="button button-primary" href={siteLinks.memberApp}>
              JOIN SEPTEMBER BETA →
            </Link>
            <Link className="button button-secondary" href={siteLinks.gymGoers}>
              GET REGIONAL UPDATES →
            </Link>
            <Link className="button button-secondary" href={siteLinks.brands}>
              EXPLORE PARTNERSHIPS →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
