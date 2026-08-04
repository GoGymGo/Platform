import type { Metadata } from "next";
import Link from "next/link";
import { BrandForm } from "../components/InterestForms";

export const metadata: Metadata = {
  alternates: { canonical: "/brands" },
  description:
    "Explore GoGymGo partner-gym opportunities and future regional campaigns for gym operators and fitness brands.",
  title: "Partner with GoGymGo",
};

const partnerSteps = [
  {
    title: "01 // CHOOSE THE PARTNERSHIP",
    copy: "Tell us whether you operate a gym, provide rewards, or want to support a future regional campaign.",
  },
  {
    title: "02 // CONFIRM THE OPERATING DETAILS",
    copy: "Define the location, region, member experience, inventory, fulfillment, or support responsibilities that apply.",
  },
  {
    title: "03 // REVIEW AND ACTIVATE",
    copy: "Agree on verification, creative, disclosures, reporting scope, and regional requirements before anything goes live.",
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
            Build a partnership around real gym <span>visits.</span>
          </h1>
          <p>
            GoGymGo reviews partner-gym and fitness-brand inquiries for future
            regional programs. Gym operators can explore active-poster
            verification, while brands can propose rewards and approved
            campaigns. The current September pilot reward is sponsored by GoGymGo.
          </p>
          <div className="audience-actions">
            <Link
              className="button button-pink"
              data-analytics-event="brand_partnership_click"
              href="#brand-form"
            >
              START A PARTNERSHIP REQUEST <span aria-hidden="true">↓</span>
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
            <h2 id="brand-form-title">Tell us where you fit</h2>
            <p>
              Share your organization, region, locations, operating needs, or
              campaign idea. We review inquiries weekly and aim to respond
              within five business days.
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
            Every gym and campaign is reviewed before activation.
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
