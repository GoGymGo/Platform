import type { Metadata } from "next";
import { DemoCompetition } from "../components/DemoCompetition";

export const metadata: Metadata = {
  title: "Join the demo competition",
  description:
    "Create a local demo Alias, choose a Weekly Goal, and try the GoGymGo verified-workout competition loop.",
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
