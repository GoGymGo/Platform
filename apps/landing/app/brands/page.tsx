import type { Metadata } from "next";
import { BrandForm } from "../components/InterestForms";

export const metadata: Metadata = {
  title: "Fitness brand partnerships",
  description:
    "Apply to become a founding GoGymGo fitness brand partner through regional campaigns, Brand Rewards, creator activations, or partner gym programs.",
};

const points = [
  {
    title: "REGIONAL REACH",
    copy: "Support active gym communities in the regions that matter to your brand.",
  },
  {
    title: "REWARD MOMENTS",
    copy: "Supply physical products or coupon codes for audited regional draws.",
  },
  {
    title: "CONTEXTUAL PLACEMENT",
    copy: "Appear in approved competition, workout-complete, and reward moments.",
  },
  {
    title: "PRIVACY-SAFE REPORTING",
    copy: "Measure aggregate reach and actions without private health or workout evidence.",
  },
];

export default function BrandsPage() {
  return (
    <main className="audience-page brand-page">
      <div className="shell audience-hero">
        <div className="audience-copy">
          <p className="eyebrow eyebrow-pink">
            <span className="status-dot" />
            FOR FITNESS BRANDS
          </p>
          <h1>
            Back the habit.
            <br />
            Earn real <span>attention.</span>
          </h1>
          <p>
            Join GoGymGo as a founding fitness brand partner. Help reward
            verified consistency through regional campaigns designed around
            participation—not private personal data.
          </p>
          <div className="audience-points">
            {points.map((point) => (
              <div className="audience-point" key={point.title}>
                <strong>{point.title}</strong>
                <span>{point.copy}</span>
              </div>
            ))}
          </div>
        </div>

        <section className="form-card" aria-labelledby="brand-form-title">
          <div className="form-card-header">
            <span>FOUNDING PARTNER INTAKE // OPEN</span>
            <h2 id="brand-form-title">Tell us about your brand</h2>
            <p>
              Share the opportunity you’re exploring and we’ll follow up at
              your work email.
            </p>
          </div>
          <BrandForm />
        </section>
      </div>
    </main>
  );
}
