"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const demoStages = [
  { id: "welcome", label: "WELCOME" },
  { id: "region", label: "REGION + AGREEMENTS" },
  { id: "goal", label: "WEEKLY GOAL" },
  { id: "home", label: "HOME" },
  { id: "method", label: "WORKOUT METHOD" },
  { id: "timer", label: "ACTIVE TIMER" },
  { id: "complete", label: "COMPLETE" },
  { id: "results", label: "RESULTS + REWARDS" },
] as const;

type DemoStage = (typeof demoStages)[number]["id"];
type VerificationMethod = "heart-rate" | "partner-qr";

type DemoState = {
  agreementsAccepted: boolean;
  alias: string;
  elapsed: number;
  goalDays: number;
  method: VerificationMethod;
  regionVerified: boolean;
  stage: DemoStage;
  verifiedDays: number;
};

const initialState: DemoState = {
  agreementsAccepted: false,
  alias: "CAMERON12",
  elapsed: 1122,
  goalDays: 4,
  method: "heart-rate",
  regionVerified: false,
  stage: "welcome",
  verifiedDays: 0,
};

const storageKey = "gogymgo-app-flow-demo-v2";

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isDemoStage(value: unknown): value is DemoStage {
  return demoStages.some((stage) => stage.id === value);
}

function restoreDemoState(value: unknown): DemoState | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Partial<DemoState>;
  if (
    !isDemoStage(saved.stage) ||
    typeof saved.alias !== "string" ||
    typeof saved.goalDays !== "number" ||
    saved.goalDays < 1 ||
    saved.goalDays > 7 ||
    (saved.method !== "heart-rate" && saved.method !== "partner-qr") ||
    typeof saved.regionVerified !== "boolean" ||
    typeof saved.agreementsAccepted !== "boolean" ||
    typeof saved.elapsed !== "number" ||
    typeof saved.verifiedDays !== "number"
  ) {
    return null;
  }
  return saved as DemoState;
}

function AppHeader({
  label,
  progress,
  step,
}: {
  label: string;
  progress: number;
  step: string;
}) {
  return (
    <>
      <div className="demo-app-header">
        <span className="demo-app-back" aria-hidden="true">
          &lt;
        </span>
        <span>{step}</span>
        <strong>{label}</strong>
      </div>
      <div className="demo-app-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
    </>
  );
}

function DemoButton({
  children,
  disabled = false,
  onClick,
  tone = "cyan",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: "cyan" | "green" | "pink";
}) {
  return (
    <button
      className={`demo-app-button tone-${tone}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function DemoWelcome({
  alias,
  onAliasChange,
  onContinue,
}: {
  alias: string;
  onAliasChange: (alias: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="demo-screen demo-welcome-screen">
      <div className="demo-online-label">
        <i />
        <span>SYSTEM ONLINE // REGISTRATION OPEN</span>
      </div>
      <div className="demo-app-logo" aria-label="GoGymGo">
        <span>GO</span>
        <b>GYM</b>
        <span>GO</span>
      </div>
      <p className="demo-welcome-copy">
        Complete verified workouts, compete in your region and earn chances to
        win brand rewards.
      </p>
      <div className="demo-welcome-steps">
        <span>
          <b>01</b>
          SET GOAL
        </span>
        <span>
          <b>02</b>
          VERIFY
        </span>
        <span>
          <b>03</b>
          COMPETE
        </span>
      </div>
      <label className="demo-alias-field">
        <span>DEMO ALIAS</span>
        <input
          aria-label="Demo Alias"
          maxLength={16}
          onChange={(event) =>
            onAliasChange(
              event.target.value
                .replace(/[^A-Za-z0-9_]/g, "")
                .toUpperCase(),
            )
          }
          value={alias}
        />
      </label>
      <p className="demo-sponsor-line">
        FREE TO PLAY // FUNDED BY SPONSORS
      </p>
      <DemoButton onClick={onContinue}>GET STARTED →</DemoButton>
      <p className="demo-local-note">
        This walkthrough stays in your browser. It creates no real account,
        competition standing, Prize Draw Entry, or reward.
      </p>
    </div>
  );
}

function DemoRegion({
  agreementsAccepted,
  onAcceptAgreements,
  onContinue,
  onVerifyRegion,
  regionVerified,
}: {
  agreementsAccepted: boolean;
  onAcceptAgreements: () => void;
  onContinue: () => void;
  onVerifyRegion: () => void;
  regionVerified: boolean;
}) {
  return (
    <div className="demo-screen">
      <AppHeader label="REGION + AGREEMENTS" progress={50} step="SETUP // 1 OF 2" />
      <h3>{regionVerified ? "REGION VERIFIED" : "VERIFY YOUR REGION"}</h3>
      <p className="demo-screen-copy">
        Confirm your competition region, then review the required agreements
        in one place.
      </p>
      {!regionVerified ? (
        <>
          <div className="demo-hud">
            <span className="demo-label">ONE-TIME LOCATION CHECK</span>
            <p>
              The app uses your device location once to match you with the
              correct regional competition.
            </p>
            <small>DEMO ONLY // NO LOCATION IS READ</small>
          </div>
          <DemoButton onClick={onVerifyRegion}>USE MY LOCATION →</DemoButton>
        </>
      ) : (
        <>
          <div className="demo-hud tone-green demo-region-verified">
            <div>
              <span>VERIFIED REGION</span>
              <strong>VANCOUVER</strong>
            </div>
            <b>VERIFIED</b>
          </div>
          <div className="demo-hud demo-agreements">
            <span className="demo-label">ACCOUNT AGREEMENTS</span>
            <p>Review both documents before continuing.</p>
            <div className="demo-legal-links">
              <span>PRIVACY POLICY</span>
              <span>TERMS OF SERVICE</span>
            </div>
            <label>
              <input
                checked={agreementsAccepted}
                onChange={onAcceptAgreements}
                type="checkbox"
              />
              <span>I have reviewed and accept the account agreements.</span>
            </label>
          </div>
          <DemoButton disabled={!agreementsAccepted} onClick={onContinue}>
            CONTINUE TO WEEKLY GOAL →
          </DemoButton>
        </>
      )}
    </div>
  );
}

function GoalSummary({ goalDays }: { goalDays: number }) {
  return (
    <div className="demo-hud demo-goal-summary">
      <div>
        <strong>{goalDays}</strong>
        <span>DAYS / WEEK</span>
      </div>
      <div>
        <strong>{goalDays}</strong>
        <span>ENTRIES / HIT WEEK</span>
      </div>
      <div>
        <strong>{goalDays * 4}</strong>
        <span>FOUR-WEEK BASE</span>
      </div>
      <p>Earn more through consistency, teamwork and competition.</p>
      <button type="button">VIEW BONUS DETAILS</button>
    </div>
  );
}

function DemoGoal({
  goalDays,
  onContinue,
  onGoalChange,
}: {
  goalDays: number;
  onContinue: () => void;
  onGoalChange: (goal: number) => void;
}) {
  return (
    <div className="demo-screen">
      <AppHeader label="WEEKLY GOAL" progress={100} step="SETUP // 2 OF 2" />
      <h3>CHOOSE YOUR WEEKLY GOAL</h3>
      <p className="demo-screen-copy">
        Choose a realistic number of workout days you can repeat each week.
      </p>
      <div className="demo-day-picker" role="radiogroup">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <button
            aria-checked={goalDays === day}
            className={goalDays === day ? "is-selected" : ""}
            key={day}
            onClick={() => onGoalChange(day)}
            role="radio"
            type="button"
          >
            <strong>{day}</strong>
            <span>{day === 1 ? "DAY" : "DAYS"}</span>
          </button>
        ))}
      </div>
      <GoalSummary goalDays={goalDays} />
      <div className="demo-hud demo-confirm-goal">
        <span className="demo-label">CONFIRM YOUR {goalDays}-DAY GOAL</span>
        <p>This demo skips the real registration check.</p>
      </div>
      <DemoButton onClick={onContinue}>CONFIRM + REGISTER →</DemoButton>
    </div>
  );
}

function DemoHome({
  alias,
  goalDays,
  onContinue,
}: {
  alias: string;
  goalDays: number;
  onContinue: () => void;
}) {
  return (
    <div className="demo-screen">
      <div className="demo-home-header">
        <div>
          <span>ACCOUNT READY // VANCOUVER</span>
          <strong>{alias || "CAMERON12"}</strong>
        </div>
        <b>{(alias || "CA").slice(0, 2)}</b>
      </div>
      <div className="demo-hud tone-green demo-success-notice">
        <strong>WEEKLY GOAL SET // {goalDays} DAYS</strong>
        <span>You&apos;re ready. Your next action is shown below.</span>
      </div>
      <div className="demo-hud demo-home-action">
        <span>WEEK 1 // READY</span>
        <h3>START YOUR FIRST SESSION</h3>
        <p>
          Complete {goalDays} verified workouts this week to hit your Weekly
          Goal.
        </p>
        <div className="demo-home-goal">
          <strong>{goalDays}</strong>
          <span>DAY GOAL</span>
        </div>
        <DemoButton onClick={onContinue}>START WORKOUT →</DemoButton>
      </div>
      <div className="demo-mini-cards">
        <span>WORKOUT CALENDAR →</span>
        <span>WEEKLY CHALLENGE →</span>
      </div>
      <div className="demo-tab-bar" aria-hidden="true">
        <b>HOME</b>
        <span>LOG</span>
        <span>TRAIN</span>
        <span>COMPETE</span>
        <span>ME</span>
      </div>
    </div>
  );
}

function DemoMethod({
  method,
  onContinue,
  onMethodChange,
}: {
  method: VerificationMethod;
  onContinue: () => void;
  onMethodChange: (method: VerificationMethod) => void;
}) {
  return (
    <div className="demo-screen">
      <AppHeader label="WORKOUT VERIFICATION" progress={100} step="START WORKOUT" />
      <h3>CHOOSE HOW TO VERIFY</h3>
      <p className="demo-screen-copy">
        Pick the available method you will use for this workout.
      </p>
      <div className="demo-method-list">
        <button
          className={method === "heart-rate" ? "is-selected" : ""}
          onClick={() => onMethodChange("heart-rate")}
          type="button"
        >
          <span>
            <b>HEART-RATE DEVICE</b>
            <small>Use eligible live heart-rate telemetry.</small>
          </span>
          <strong>{method === "heart-rate" ? "SELECTED" : "SELECT"}</strong>
        </button>
        <button
          className={method === "partner-qr" ? "is-selected" : ""}
          onClick={() => onMethodChange("partner-qr")}
          type="button"
        >
          <span>
            <b>PARTNER GYM QR</b>
            <small>Use a verified gym&apos;s entry and exit QR.</small>
          </span>
          <strong>{method === "partner-qr" ? "SELECTED" : "SELECT"}</strong>
        </button>
      </div>
      <div className="demo-hud">
        <p>
          The real app only shows verification methods that are available for
          your account and region.
        </p>
      </div>
      <DemoButton onClick={onContinue}>CONTINUE TO CHECK-IN →</DemoButton>
    </div>
  );
}

function DemoTimer({
  elapsed,
  method,
  onContinue,
}: {
  elapsed: number;
  method: VerificationMethod;
  onContinue: () => void;
}) {
  const progress = Math.min(100, Math.round((elapsed / 1800) * 100));
  return (
    <div className="demo-screen">
      <div className="demo-session-title">
        <span>
          <i />
          SESSION ACTIVE
        </span>
        <strong>{method === "heart-rate" ? "HEART RATE" : "PARTNER GYM QR"}</strong>
      </div>
      <div className="demo-hud demo-live-session">
        <div className="demo-live-grid">
          <div>
            <span>ELAPSED TIME</span>
            <strong>{formatTimer(elapsed)}</strong>
            <small>30:00 MINIMUM</small>
          </div>
          <div>
            <span>LIVE HEART RATE</span>
            <strong>{method === "heart-rate" ? "138" : "--"}</strong>
            <small>{method === "heart-rate" ? "BPM // ON TRACK" : "QR VERIFIED"}</small>
          </div>
        </div>
        <div className="demo-timer-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="demo-progress-labels">
          <span>START</span>
          <span>CHECK</span>
          <span>END</span>
        </div>
      </div>
      <div className="demo-hud demo-session-verification">
        <div>
          <span>VERIFICATION</span>
          <strong>
            {method === "heart-rate"
              ? "HEART RATE SESSION"
              : "PARTNER GYM CHECK-IN"}
          </strong>
        </div>
        <b>IN PROGRESS</b>
        <p>
          Your timer and verification progress save automatically. Keep moving;
          GoGymGo tells you when an action is needed.
        </p>
      </div>
      <DemoButton onClick={onContinue} tone="green">
        COMPLETE DEMO SESSION →
      </DemoButton>
      <p className="demo-local-note">
        The walkthrough stays roadblock-free; the real app waits for eligible
        verification evidence before enabling completion.
      </p>
    </div>
  );
}

function DemoComplete({
  goalDays,
  onContinue,
}: {
  goalDays: number;
  onContinue: () => void;
}) {
  return (
    <div className="demo-screen demo-complete-screen">
      <div className="demo-complete-mark">✓</div>
      <span className="demo-label">WORKOUT COMPLETE // VERIFIED</span>
      <h3>YOUR FIRST DAY COUNTS.</h3>
      <p className="demo-screen-copy">
        The demo session is approved. Weekly Goal progress and sample
        competition state are now updated.
      </p>
      <div className="demo-result-metrics">
        <div>
          <strong>1/{goalDays}</strong>
          <span>WEEKLY GOAL</span>
        </div>
        <div>
          <strong>1</strong>
          <span>VERIFIED DAY</span>
        </div>
        <div>
          <strong>1D</strong>
          <span>STREAK</span>
        </div>
      </div>
      <div className="demo-hud tone-pink demo-entry-result">
        <span>PRIZE DRAW ENTRIES</span>
        <strong>WEEK IN PROGRESS</strong>
        <small>Entries settle after the Weekly Goal result is known.</small>
      </div>
      <DemoButton onClick={onContinue}>VIEW REGIONAL COMPETITION →</DemoButton>
    </div>
  );
}

const resultRows = [
  {
    alias: "CORE_FOUR",
    rank: "01",
    reward: "PACIFIC MOTION TRAINING KIT",
    state: "READY TO CLAIM",
  },
  {
    alias: "NEON_4",
    rank: "02",
    reward: "VOLT 25% DIGITAL REWARD",
    state: "CLAIMED",
  },
  {
    alias: "KODA_FIT",
    rank: "03",
    reward: "NOVA SHAKER",
    state: "READY TO CLAIM",
  },
] as const;

function DemoResults({ alias }: { alias: string }) {
  return (
    <div className="demo-screen">
      <div className="demo-results-title">
        <span>SAMPLE RESULTS // VANCOUVER</span>
        <h3>WINNERS CIRCLE</h3>
        <p>JULY COMPETITION</p>
      </div>
      <div className="demo-hud tone-pink demo-winner-summary">
        <div>
          <strong>3</strong>
          <span>GOAL-GROUP LEADERS</span>
        </div>
        <div>
          <strong>3</strong>
          <span>REWARD WINNERS</span>
        </div>
      </div>
      <div className="demo-results-head">
        <span>PLAYER + BRAND REWARD</span>
        <span>STATUS</span>
      </div>
      <div className="demo-winner-list">
        {resultRows.map((row) => (
          <div key={row.rank}>
            <span>{row.rank}</span>
            <p>
              <strong>{row.alias}</strong>
              <small>{row.reward}</small>
            </p>
            <b>{row.state}</b>
          </div>
        ))}
      </div>
      <div className="demo-hud demo-your-result">
        <span>YOUR DEMO RESULT</span>
        <strong>
          {alias || "CAMERON12"}
          {" // WEEK 1 IN PROGRESS"}
        </strong>
        <small>Sample results never create a real standing or reward.</small>
      </div>
      <Link className="demo-app-link-button" href="/gym-goers">
        PRE-REGISTER FOR LAUNCH →
      </Link>
    </div>
  );
}

export function DemoCompetition() {
  const [state, setState] = useState<DemoState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const restored = restoreDemoState(JSON.parse(saved) as unknown);
          if (restored) setState(restored);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (state.stage !== "timer") return;
    const interval = window.setInterval(() => {
      setState((current) => ({
        ...current,
        elapsed: Math.min(1800, current.elapsed + 60),
      }));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [state.stage]);

  const stageIndex = demoStages.findIndex((stage) => stage.id === state.stage);
  const currentStage = demoStages[stageIndex];
  const completedPercent = Math.round(
    ((stageIndex + 1) / demoStages.length) * 100,
  );
  const nextStage = useMemo(
    () => demoStages[Math.min(demoStages.length - 1, stageIndex + 1)]?.id,
    [stageIndex],
  );

  function patchState(patch: Partial<DemoState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function moveTo(stage: DemoStage) {
    patchState({ stage });
  }

  function moveNext() {
    if (nextStage) moveTo(nextStage);
  }

  function resetDemo() {
    window.localStorage.removeItem(storageKey);
    setState(initialState);
  }

  if (!hydrated) {
    return (
      <div className="demo-loading" role="status">
        LOADING APP WALKTHROUGH…
      </div>
    );
  }

  return (
    <section className="demo-experience">
      <header className="demo-page-heading">
        <div>
          <p className="eyebrow">
            <span className="status-dot" />
            INTERACTIVE APP WALKTHROUGH
          </p>
          <h1>
            Use the <span>real flow.</span>
          </h1>
        </div>
        <p>
          Click through the same setup, workout, and competition sequence as the
          mobile app. The walkthrough is accelerated and local, so there are no
          account or backend roadblocks.
        </p>
      </header>

      <div className="demo-walkthrough">
        <aside className="demo-route-rail" aria-label="Demo screens">
          <div className="demo-route-heading">
            <span>APP FLOW</span>
            <strong>
              {String(stageIndex + 1).padStart(2, "0")} /{" "}
              {String(demoStages.length).padStart(2, "0")}
            </strong>
          </div>
          <div className="demo-route-progress">
            <span style={{ width: `${completedPercent}%` }} />
          </div>
          <nav>
            {demoStages.map((stage, index) => (
              <button
                aria-current={state.stage === stage.id ? "step" : undefined}
                className={
                  state.stage === stage.id
                    ? "is-current"
                    : index < stageIndex
                      ? "is-complete"
                      : ""
                }
                key={stage.id}
                onClick={() => moveTo(stage.id)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage.label}</strong>
                <b>{index < stageIndex ? "✓" : "→"}</b>
              </button>
            ))}
          </nav>
          <div className="demo-rail-note">
            <strong>LOCAL DEMO</strong>
            <span>Jump to any screen. Nothing is sent to GoGymGo.</span>
          </div>
          <button className="demo-reset" onClick={resetDemo} type="button">
            RESET WALKTHROUGH
          </button>
        </aside>

        <div className="demo-device-column">
          <div className="demo-device-label">
            <span>{currentStage.label}</span>
            <strong>APP-MATCHED SCREEN</strong>
          </div>
          <div className="demo-device">
            <div className="demo-device-screen">
              {state.stage === "welcome" ? (
                <DemoWelcome
                  alias={state.alias}
                  onAliasChange={(alias) => patchState({ alias })}
                  onContinue={moveNext}
                />
              ) : null}
              {state.stage === "region" ? (
                <DemoRegion
                  agreementsAccepted={state.agreementsAccepted}
                  onAcceptAgreements={() =>
                    patchState({
                      agreementsAccepted: !state.agreementsAccepted,
                    })
                  }
                  onContinue={moveNext}
                  onVerifyRegion={() => patchState({ regionVerified: true })}
                  regionVerified={state.regionVerified}
                />
              ) : null}
              {state.stage === "goal" ? (
                <DemoGoal
                  goalDays={state.goalDays}
                  onContinue={moveNext}
                  onGoalChange={(goalDays) => patchState({ goalDays })}
                />
              ) : null}
              {state.stage === "home" ? (
                <DemoHome
                  alias={state.alias}
                  goalDays={state.goalDays}
                  onContinue={moveNext}
                />
              ) : null}
              {state.stage === "method" ? (
                <DemoMethod
                  method={state.method}
                  onContinue={moveNext}
                  onMethodChange={(method) => patchState({ method })}
                />
              ) : null}
              {state.stage === "timer" ? (
                <DemoTimer
                  elapsed={state.elapsed}
                  method={state.method}
                  onContinue={() =>
                    patchState({
                      elapsed: 1800,
                      stage: "complete",
                      verifiedDays: 1,
                    })
                  }
                />
              ) : null}
              {state.stage === "complete" ? (
                <DemoComplete goalDays={state.goalDays} onContinue={moveNext} />
              ) : null}
              {state.stage === "results" ? (
                <DemoResults alias={state.alias} />
              ) : null}
            </div>
            <div className="demo-device-homebar" aria-hidden="true" />
          </div>
          <div className="demo-device-controls">
            <button
              disabled={stageIndex === 0}
              onClick={() => moveTo(demoStages[stageIndex - 1].id)}
              type="button"
            >
              ← PREVIOUS
            </button>
            <span>SCREEN {stageIndex + 1} OF {demoStages.length}</span>
            <button
              disabled={stageIndex === demoStages.length - 1}
              onClick={moveNext}
              type="button"
            >
              NEXT →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
