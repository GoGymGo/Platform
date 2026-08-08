import type { Metadata } from "next";
import Link from "next/link";
import { BrandForm } from "../components/InterestForms";
import { siteLinks } from "../site-links";

export const metadata: Metadata = {
  alternates: { canonical: "/partners" },
  description:
    "Explore GoGymGo Partner gym opportunities and future regional campaigns for gym operators and fitness brands.",
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

type PartnersPageProps = {
  searchParams: Promise<{ interest?: string | string[] }>;
};

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  const params = await searchParams;
  const interest = Array.isArray(params.interest)
    ? params.interest[0]
    : params.interest;
  const defaultInterest =
    interest === "gym"
      ? "gym-partnership"
      : interest === "brand"
        ? "regional-sponsor"
        : "";

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
            GoGymGo reviews Partner gym and fitness-brand inquiries for future
            regional programs. Gym operators can explore active-poster
            verification, while brands can propose rewards and approved
            campaigns. The current September pilot reward is sponsored by
            GoGymGo.
          </p>
          <div aria-label="Choose a partnership path" className="partner-choices">
            <Link
              data-analytics-event="brand_partnership_click"
              href={siteLinks.gymPartnerApplication}
            >
              <strong>I OPERATE A GYM</strong>
              <span>Request a review for one or more gym locations.</span>
            </Link>
            <Link
              data-analytics-event="brand_partnership_click"
              href={siteLinks.brandPartnerApplication}
            >
              <strong>I REPRESENT A BRAND</strong>
              <span>Propose rewards, inventory, or a regional campaign.</span>
            </Link>
          </div>
        </div>

        <section
          aria-labelledby="partner-details-title"
          className="audience-details"
        >
          <p className="eyebrow eyebrow-pink">WHAT HAPPENS AFTER YOU APPLY</p>
          <h2 id="partner-details-title">
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

        <section
          aria-labelledby="partner-form-title"
          className="form-card"
          id="partner-form"
        >
          <div className="form-card-header">
            <span>FOUNDING PARTNER INTAKE // OPEN</span>
            <h2 id="partner-form-title">Tell us how you want to partner</h2>
            <p>
              Share your organization, region, locations, operating needs, or
              campaign idea. We review inquiries weekly and aim to respond
              within five business days.
            </p>
            <small>Fields marked * are required.</small>
          </div>
          <BrandForm defaultInterest={defaultInterest} />
        </section>
      </div>
    </main>
  );
}
