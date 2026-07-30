import Link from "next/link";

function ScreenHeader({
  label,
  step,
}: {
  label: string;
  step: string;
}) {
  return (
    <div className="app-screen-header">
      <span className="app-screen-back" aria-hidden="true">
        &lt;
      </span>
      <span className="app-screen-step">{step}</span>
      <strong>{label}</strong>
    </div>
  );
}

function PhoneShell({
  children,
  label,
  step,
  title,
}: {
  children: React.ReactNode;
  label: string;
  step: string;
  title: string;
}) {
  return (
    <article className="product-screen-card">
      <div className="product-phone" aria-label={label}>
        <div className="product-phone-content">{children}</div>
        <div className="product-phone-homebar" aria-hidden="true" />
      </div>
      <div className="product-screen-caption">
        <span>{step}</span>
        <h3>{title}</h3>
      </div>
    </article>
  );
}

function GoalScreen() {
  return (
    <PhoneShell
      label="GoGymGo Weekly Goal and four-week entry calculation screen"
      step="01 // COMMIT"
      title="Choose a goal you can repeat"
    >
      <ScreenHeader label="WEEKLY GOAL" step="SETUP // 2 OF 2" />
      <div className="app-screen-progress">
        <span style={{ width: "100%" }} />
      </div>
      <h4>CHOOSE YOUR WEEKLY GOAL</h4>
      <p className="app-screen-copy">
        Choose a realistic number of workout days you can repeat each week.
      </p>
      <div className="app-day-picker" aria-label="Four-day Weekly Goal selected">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <span className={day === 4 ? "is-selected" : ""} key={day}>
            <strong>{day}</strong>
            <small>{day === 1 ? "DAY" : "DAYS"}</small>
          </span>
        ))}
      </div>
      <div className="app-hud app-goal-summary">
        <div>
          <strong>4</strong>
          <span>DAYS / WEEK</span>
        </div>
        <div>
          <strong>4</strong>
          <span>ENTRIES / HIT WEEK</span>
        </div>
        <div>
          <strong>16</strong>
          <span>FOUR-WEEK BASE</span>
        </div>
        <p>Earn more through consistency, teamwork and competition.</p>
        <span className="app-compact-action">VIEW BONUS DETAILS</span>
      </div>
    </PhoneShell>
  );
}

function TimerScreen() {
  return (
    <PhoneShell
      label="GoGymGo active verified workout timer screen"
      step="02 // VERIFY"
      title="Follow one clear live session"
    >
      <div className="app-session-heading">
        <span>
          <i />
          SESSION ACTIVE
        </span>
        <strong>HEART RATE</strong>
      </div>
      <div className="app-hud app-live-panel">
        <div className="app-live-metrics">
          <div>
            <span>ELAPSED TIME</span>
            <strong>18:42</strong>
            <small>30:00 MINIMUM</small>
          </div>
          <div>
            <span>LIVE HEART RATE</span>
            <strong>138</strong>
            <small>BPM // ON TRACK</small>
          </div>
        </div>
        <div className="app-workout-progress">
          <span style={{ width: "62%" }} />
        </div>
        <div className="app-workout-labels">
          <span>START</span>
          <span>CHECK</span>
          <span>END</span>
        </div>
      </div>
      <div className="app-hud app-verification-card">
        <div>
          <span>VERIFICATION</span>
          <strong>HEART RATE SESSION</strong>
        </div>
        <b>IN PROGRESS</b>
        <p>
          Your timer and verification progress save automatically. GoGymGo
          tells you when an action is needed.
        </p>
      </div>
      <div className="app-disabled-action">FINISH UNLOCKS AT 30:00</div>
    </PhoneShell>
  );
}

const rewardRows = [
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

function RewardsLeaderboardScreen() {
  return (
    <PhoneShell
      label="GoGymGo competition results with player and brand reward details"
      step="03 // COMPETE"
      title="See who won and what they can claim"
    >
      <div className="app-results-heading">
        <span>SAMPLE RESULTS // VANCOUVER</span>
        <h4>WINNERS CIRCLE</h4>
        <p>JULY COMPETITION</p>
      </div>
      <div className="app-hud app-results-summary">
        <div>
          <strong>3</strong>
          <span>GOAL-GROUP LEADERS</span>
        </div>
        <div>
          <strong>3</strong>
          <span>REWARD WINNERS</span>
        </div>
      </div>
      <div className="app-results-label">
        <strong>PLAYER + BRAND REWARD</strong>
        <span>STATUS</span>
      </div>
      <div className="app-results-list">
        {rewardRows.map((row) => (
          <div className="app-result-row" key={row.rank}>
            <span>{row.rank}</span>
            <div>
              <strong>{row.alias}</strong>
              <small>{row.reward}</small>
            </div>
            <b>{row.state}</b>
          </div>
        ))}
      </div>
      <p className="app-results-note">
        Illustrative demo results. No real reward or claim is created.
      </p>
    </PhoneShell>
  );
}

export function ProductScreens() {
  return (
    <section className="section product-showcase" id="product">
      <div className="shell">
        <div className="section-heading product-showcase-heading">
          <div>
            <p className="eyebrow">THE CORE APP FLOW</p>
            <h2>Three screens. One clear reason to keep going.</h2>
          </div>
          <div>
            <p>
              The website now uses the same interface language as the app:
              focused panels, one primary action, and clear status at every
              step.
            </p>
            <Link className="text-link" href="/demo">
              WALK THROUGH THE REAL FLOW <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="product-screen-grid">
          <GoalScreen />
          <TimerScreen />
          <RewardsLeaderboardScreen />
        </div>
      </div>
    </section>
  );
}
