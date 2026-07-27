"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type VerificationMethod = "heart-rate" | "partner-qr";
type DemoPhase = "ready" | "running" | "verified";

type DemoProfile = {
  alias: string;
  goalDays: number;
  joinedAt: string;
  method: VerificationMethod;
  region: string;
  verifiedDays: number;
};

const storageKey = "gogymgo-demo-competition";

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isDemoProfile(value: unknown): value is DemoProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<DemoProfile>;
  return (
    typeof profile.alias === "string" &&
    typeof profile.goalDays === "number" &&
    profile.goalDays >= 1 &&
    profile.goalDays <= 7 &&
    typeof profile.region === "string" &&
    (profile.method === "heart-rate" || profile.method === "partner-qr") &&
    typeof profile.joinedAt === "string" &&
    typeof profile.verifiedDays === "number"
  );
}

function saveProfile(profile: DemoProfile) {
  window.localStorage.setItem(storageKey, JSON.stringify(profile));
}

export function DemoCompetition() {
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [phase, setPhase] = useState<DemoPhase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [goalDays, setGoalDays] = useState(4);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restoreDemo = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as unknown;
          if (isDemoProfile(parsed)) setProfile(parsed);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreDemo);
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      setElapsed((current) => Math.min(current + 60, 1800));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const projectedBaseEntries = useMemo(
    () => (profile?.goalDays ?? goalDays) * 4 + 1,
    [goalDays, profile?.goalDays],
  );

  function joinDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextProfile: DemoProfile = {
      alias: String(formData.get("alias") ?? "").trim().toUpperCase(),
      goalDays,
      joinedAt: new Date().toISOString(),
      method: String(formData.get("method")) as VerificationMethod,
      region: String(formData.get("region")),
      verifiedDays: 0,
    };
    saveProfile(nextProfile);
    setProfile(nextProfile);
    setPhase("ready");
    setElapsed(0);
  }

  function startWorkout() {
    setElapsed(0);
    setPhase("running");
  }

  function verifyWorkout() {
    if (!profile) return;
    const nextProfile = {
      ...profile,
      verifiedDays: Math.min(profile.verifiedDays + 1, profile.goalDays),
    };
    saveProfile(nextProfile);
    setProfile(nextProfile);
    setElapsed(1800);
    setPhase("verified");
  }

  function resetDemo() {
    window.localStorage.removeItem(storageKey);
    setProfile(null);
    setGoalDays(4);
    setElapsed(0);
    setPhase("ready");
  }

  if (!hydrated) {
    return (
      <div className="demo-loading" role="status">
        LOADING DEMO COMPETITION…
      </div>
    );
  }

  if (!profile) {
    return (
      <section className="demo-join-layout">
        <div className="demo-join-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            DEMO COMPETITION // OPEN
          </p>
          <h1>
            Join the competition.
            <br />
            <span>Try the loop.</span>
          </h1>
          <p>
            Create a demo Alias, choose the number of verified days you can
            repeat each week, and enter a sample regional competition. Nothing
            here creates a real account, entry, or reward claim.
          </p>
          <div className="demo-facts">
            <div>
              <strong>4 WEEKS</strong>
              <span>Monthly scoring runway</span>
            </div>
            <div>
              <strong>1–7 DAYS</strong>
              <span>Your commitment category</span>
            </div>
            <div>
              <strong>30:00</strong>
              <span>Simulated workout minimum</span>
            </div>
          </div>
        </div>

        <form className="demo-join-card" onSubmit={joinDemo}>
          <div className="demo-card-header">
            <span>JULY 2026 // SAMPLE REGION</span>
            <h2>Build your demo player</h2>
            <p>Your progress stays on this device and can be reset anytime.</p>
          </div>

          <div className="field">
            <label htmlFor="demoAlias">PUBLIC ALIAS *</label>
            <input
              autoComplete="off"
              id="demoAlias"
              maxLength={24}
              minLength={3}
              name="alias"
              pattern="[A-Za-z0-9_]{3,24}"
              placeholder="e.g. COAST_RUNNER"
              required
            />
            <small>3–24 letters, numbers, or underscores.</small>
          </div>

          <div className="field">
            <label htmlFor="demoRegion">DEMO REGION *</label>
            <select defaultValue="vancouver" id="demoRegion" name="region" required>
              <option value="VANCOUVER">Vancouver</option>
              <option value="TORONTO">Toronto</option>
            </select>
          </div>

          <fieldset className="demo-fieldset">
            <legend>WEEKLY GOAL *</legend>
            <div className="demo-goal-options">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <label className={goalDays === day ? "is-selected" : ""} key={day}>
                  <input
                    checked={goalDays === day}
                    name="goalDays"
                    onChange={() => setGoalDays(day)}
                    type="radio"
                    value={day}
                  />
                  <strong>{day}</strong>
                  <span>{day === 1 ? "DAY" : "DAYS"}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="demo-projection">
            <span>YOUR BASE-MONTH PROJECTION</span>
            <strong>
              {goalDays} × 4 + 1 = {projectedBaseEntries} ENTRIES
            </strong>
            <small>
              Four scoring weeks plus the one-time Free Entry. Other published
              results can change the final total.
            </small>
          </div>

          <fieldset className="demo-fieldset">
            <legend>DEMO VERIFICATION METHOD *</legend>
            <div className="demo-method-options">
              <label>
                <input defaultChecked name="method" type="radio" value="heart-rate" />
                <span>
                  <strong>HEART-RATE DEVICE</strong>
                  <small>Simulate eligible workout telemetry.</small>
                </span>
              </label>
              <label>
                <input name="method" type="radio" value="partner-qr" />
                <span>
                  <strong>PARTNER GYM QR</strong>
                  <small>Simulate entry and exit verification.</small>
                </span>
              </label>
            </div>
          </fieldset>

          <label className="consent-row">
            <input required type="checkbox" />
            <span>
              I understand this is a local product demo. It creates no real
              account, Prize Draw Entry, competition standing, or reward. *
            </span>
          </label>

          <button className="submit-button" type="submit">
            JOIN DEMO COMPETITION →
          </button>
        </form>
      </section>
    );
  }

  const progressPercent = Math.round(
    (Math.min(profile.verifiedDays, profile.goalDays) / profile.goalDays) * 100,
  );
  const timerPercent = Math.round((elapsed / 1800) * 100);

  return (
    <section className="demo-dashboard">
      <div className="demo-dashboard-topline">
        <div>
          <span>DEMO COMPETITION // {profile.region}</span>
          <strong>{profile.alias}</strong>
        </div>
        <button onClick={resetDemo} type="button">
          RESET DEMO
        </button>
      </div>

      <div className="demo-dashboard-grid">
        <aside className="demo-player-card">
          <div className="demo-avatar">{profile.alias.slice(0, 2)}</div>
          <span>4-WEEK COMPETITION</span>
          <h2>{profile.alias}</h2>
          <p>
            {profile.goalDays}-DAY CATEGORY //{" "}
            {profile.method === "heart-rate"
              ? "HEART-RATE DEVICE"
              : "PARTNER GYM QR"}
          </p>
          <div className="demo-player-stats">
            <div>
              <span>VERIFIED</span>
              <strong>{profile.verifiedDays}</strong>
            </div>
            <div>
              <span>WEEKLY GOAL</span>
              <strong>{profile.goalDays}</strong>
            </div>
            <div>
              <span>BASE ENTRY PROJECTION</span>
              <strong>{projectedBaseEntries}</strong>
            </div>
          </div>
          <div className="demo-goal-progress">
            <div>
              <span>WEEK 1 PROGRESS</span>
              <strong>
                {profile.verifiedDays} / {profile.goalDays}
              </strong>
            </div>
            <div className="demo-progress-track">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </aside>

        <div className="demo-stage-card">
          {phase === "ready" ? (
            <div className="demo-ready-state">
              <p className="eyebrow">NEXT ACTION // VERIFIED WORKOUT</p>
              <h1>Ready for day {profile.verifiedDays + 1}?</h1>
              <p>
                Start a clearly labelled, accelerated simulation of the
                30-minute workout verification flow. This demo never submits
                evidence or awards real credit.
              </p>
              <div className="demo-ready-checks">
                <span>✓ DEMO ENROLLMENT ACTIVE</span>
                <span>✓ WEEKLY GOAL LOCKED</span>
                <span>✓ VERIFICATION METHOD READY</span>
              </div>
              <button className="button button-primary" onClick={startWorkout} type="button">
                START DEMO WORKOUT →
              </button>
            </div>
          ) : null}

          {phase === "running" ? (
            <div className="demo-workout-state">
              <div className="demo-workout-status">
                <span>● DEMO SESSION TRACKING</span>
                <strong>ACCELERATED</strong>
              </div>
              <div className="demo-workout-timer">
                <span>ELAPSED</span>
                <strong>{formatTimer(elapsed)}</strong>
                <small>OF 30:00 DEMO MINIMUM</small>
              </div>
              <div className="demo-progress-track demo-timer-track">
                <span style={{ width: `${timerPercent}%` }} />
              </div>
              <div className="demo-live-metrics">
                <div>
                  <span>CURRENT BPM</span>
                  <strong>138</strong>
                  <small>SIMULATED</small>
                </div>
                <div>
                  <span>PRESENCE</span>
                  <strong>READY</strong>
                  <small>LOCAL DEMO</small>
                </div>
              </div>
              <button className="button button-primary" onClick={verifyWorkout} type="button">
                SUBMIT DEMO WORKOUT →
              </button>
              <p>
                Demo completion skips real evidence review and immediately
                shows the approved-state experience.
              </p>
            </div>
          ) : null}

          {phase === "verified" ? (
            <div className="demo-verified-state">
              <div className="demo-verified-mark">✓</div>
              <p className="eyebrow">DEMO RESULT // VERIFIED</p>
              <h1>Your first day counts.</h1>
              <p>
                The simulated review approved this workout. Your Week 1
                progress, streak, and sample standing have now updated.
              </p>
              <div className="demo-result-grid">
                <div>
                  <span>VERIFIED DAYS</span>
                  <strong>{profile.verifiedDays}</strong>
                </div>
                <div>
                  <span>DEMO RANK</span>
                  <strong>#18</strong>
                </div>
                <div>
                  <span>STREAK</span>
                  <strong>{profile.verifiedDays}D</strong>
                </div>
              </div>
              <div className="demo-sample-reward">
                <span>SAMPLE BRAND REWARD</span>
                <strong>PACIFIC MOTION TRAINING KIT</strong>
                <small>LOCKED // ELIGIBLE AFTER DEMO SETTLEMENT</small>
              </div>
              <div className="demo-verified-actions">
                <button className="button button-secondary" onClick={startWorkout} type="button">
                  RUN ANOTHER DAY
                </button>
                <Link className="button button-primary" href="/gym-goers">
                  PRE-REGISTER FOR LAUNCH →
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
