import type { Metadata } from "next";
import { GymGoerForm } from "../components/InterestForms";

export const metadata: Metadata = {
  title: "Gym-goer pre-registration",
  description:
    "Pre-register for GoGymGo launch updates and be among the first to hear when verified workout competitions open in your region.",
};

const points = [
  {
    title: "SET YOUR GOAL",
    copy: "Choose a 1–7 day Weekly Goal that matches your actual routine.",
  },
  {
    title: "VERIFY THE WORK",
    copy: "An approved gym QR scan plus live proximity keeps the September pilot fair.",
  },
  {
    title: "BRING FRIENDS",
    copy: "Build streaks, send challenges, and choose a Weekly Challenge partner.",
  },
  {
    title: "EARN ENTRIES",
    copy: "Meet your goal for chances at sponsor-funded products and coupon rewards.",
  },
];

export default function GymGoersPage() {
  return (
    <main className="audience-page">
      <div className="shell audience-hero">
        <div className="audience-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            FOR GYM GOERS
          </p>
          <h1>
            Be first to
            <br />
            make it <span>count.</span>
          </h1>
          <p>
            Join the early list for GoGymGo. We’ll let you know when
            pre-registration opens in your region and share the path to the
            first monthly competition.
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

        <section className="form-card" aria-labelledby="gym-form-title">
          <div className="form-card-header">
            <span>EARLY ACCESS // FREE</span>
            <h2 id="gym-form-title">Pre-register your interest</h2>
            <p>Takes about 30 seconds. No payment details required.</p>
          </div>
          <GymGoerForm />
        </section>
      </div>
    </main>
  );
}
