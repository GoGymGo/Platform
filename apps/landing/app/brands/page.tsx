import type { Metadata } from "next";
import Link from "next/link";
import { BrandForm } from "../components/InterestForms";

export const metadata: Metadata = {
  alternates: { canonical: "/brands" },
  description:
    "Explore future GoGymGo regional campaigns, reward inventory, placements, approvals, and aggregate reporting for fitness brands.",
  title: "Fitness brand partnerships",
};

const partnerSteps = [
  {
    title: "01 // CHOOSE THE CAMPAIGN",
    copy: "Define the intended region, month, audience, placement, and destination before any public launch.",
  },
  {
    title: "02 // DEFINE REAL INVENTORY",
    copy: "Confirm in-stock physical products or valid coupon inventory, terms, availability, fulfillment, and support responsibilities.",
  },
  {
    title: "03 // REVIEW AND PUBLISH",
    copy: "Approve creative, disclosures, reporting scope, and regional requirements before anything appears in the app.",
  },
];

export default function BrandsPage() {
  return (
    <main className="audience-page brand-page">
      <div className="shell audience-hero">
        <div className="audience-copy">
          <p className="eyebrow eyebrow-pink">
            <span className="status-dot" />
            FOUNDING PARTNER PROGRAM
          </p>
          <h1>
            Reach verified gym communities at moments that <span>matter.</span>
          </h1>
          <p>
            GoGymGo is preparing future approved regional campaigns for fitness
            brands that can support real product or coupon rewards. If the
            September pilot Contest is approved and published, its sole planned
            cash reward is sponsored by GoGymGo, not an outside brand.
          </p>
          <div className="audience-actions">
            <Link
              className="button button-pink"
              data-analytics-event="brand_partnership_click"
              href="#brand-form"
            >
              REQUEST A PARTNERSHIP REVIEW <span aria-hidden="true">↓</span>
            </Link>
          </div>
        </div>

        <section
          aria-labelledby="brand-form-title"
          className="form-card"
          id="brand-form"
        >
          <div className="form-card-header">
            <span>FOUNDING PARTNER INTAKE // OPEN</span>
            <h2 id="brand-form-title">Explore a future campaign</h2>
            <p>
              Tell us the region, timing, inventory, and outcome you are
              considering. We review inquiries weekly and aim to respond within
              five business days.
            </p>
            <small>Fields marked * are required.</small>
          </div>
          <BrandForm />
        </section>

        <section
          aria-labelledby="brand-details-title"
          className="audience-details"
        >
          <p className="eyebrow eyebrow-pink">HOW A PARTNERSHIP MOVES FORWARD</p>
          <h2 id="brand-details-title">
            Nothing is presented to players before approval.
          </h2>
          <div className="audience-points partner-steps">
            {partnerSteps.map((step) => (
              <article className="audience-point" key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.copy}</span>
              </article>
            ))}
          </div>
          <p className="audience-disclosure">
            Available placements and reporting depend on campaign approval,
            regional rules, product readiness, inventory, and signed terms.
            Private health data, exact location, and private workout evidence
            are outside the partner reporting scope.
          </p>
        </section>
      </div>
    </main>
  );
}
