import type { Metadata } from "next";
import { DemoCompetition } from "../components/DemoCompetition";

export const metadata: Metadata = {
  title: "Interactive app walkthrough",
  description:
    "Click through the GoGymGo setup, Weekly Goal, verified workout, and competition results flow without creating a real account.",
};

export default function DemoPage() {
  return (
    <main className="demo-page">
      <div className="shell">
        <DemoCompetition />
      </div>
    </main>
  );
}
