import Link from "next/link";

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
        <div className="product-phone-bezel">
          <div className="product-phone-topbar">
            <span>9:41</span>
            <span>● ●●</span>
          </div>
          <div className="product-phone-content">{children}</div>
          <div className="product-phone-homebar" />
        </div>
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
      label="GoGymGo Weekly Goal and scoring calculation screen"
      step="01 // COMMIT"
      title="Pick the week you can repeat"
    >
      <div className="mobile-screen-header">
        <span>REGISTRATION</span>
        <strong>WEEKLY GOAL</strong>
      </div>
      <p className="mobile-screen-kicker">SELECT 1–7 VERIFIED DAYS</p>
      <div className="mobile-goal-grid" aria-label="Four days selected">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <span className={day === 4 ? "is-selected" : ""} key={day}>
            {day}
          </span>
        ))}
      </div>
      <div className="mobile-selected-goal">
        <span>YOUR COMMITMENT</span>
        <strong>4 DAYS / WEEK</strong>
        <small>4-DAY CATEGORY</small>
      </div>
      <div className="mobile-calc-panel">
        <span className="mobile-panel-label">BASE MONTH CALCULATION</span>
        <div className="mobile-calc-equation">
          <strong>4</strong>
          <span>×</span>
          <strong>4</strong>
          <span>=</span>
          <strong>16</strong>
        </div>
        <p>WEEKLY GOAL × 4 SCORING WEEKS</p>
        <div className="mobile-calc-total">
          <span>+ 1 FREE ENTRY</span>
          <strong>17 BASE ENTRIES</strong>
        </div>
      </div>
      <p className="mobile-screen-footnote">
        Weekly Challenge, category, Bonus Day, and Perfect Month results can
        increase the final total.
      </p>
    </PhoneShell>
  );
}

function TimerScreen() {
  return (
    <PhoneShell
      label="GoGymGo verified workout timer screen"
      step="02 // VERIFY"
      title="Prove the session"
    >
      <div className="mobile-screen-header">
        <span className="mobile-live-label">● SESSION TRACKING</span>
        <strong>WORKOUT ACTIVE</strong>
      </div>
      <div className="mobile-timer">
        <span>ELAPSED</span>
        <strong>18:42</strong>
        <small>OF 30:00 MINIMUM</small>
      </div>
      <div className="mobile-timer-track">
        <span style={{ width: "62%" }} />
      </div>
      <div className="mobile-timer-labels">
        <span>START</span>
        <span>CHECK</span>
        <span>END</span>
      </div>
      <div className="mobile-metric-grid">
        <div>
          <span>CURRENT BPM</span>
          <strong>138</strong>
          <small>ABOVE TARGET</small>
        </div>
        <div>
          <span>30-MIN AVG</span>
          <strong>130</strong>
          <small>100+ REQUIRED</small>
        </div>
      </div>
      <div className="mobile-status-stack">
        <div>
          <span>EFFORT</span>
          <strong>HEART RATE ON TRACK</strong>
        </div>
        <div>
          <span>PRESENCE CHECK</span>
          <strong>READY AT MIDPOINT</strong>
        </div>
        <div>
          <span>SESSION SAVE</span>
          <strong>AUTO-SAVED</strong>
        </div>
      </div>
      <div className="mobile-timer-action">FINISH UNLOCKS AT 30:00</div>
    </PhoneShell>
  );
}

function RewardsLeaderboardScreen() {
  const rows = [
    {
      alias: "CORE_FOUR",
      rank: "01",
      reward: "CLAIM · PACIFIC MOTION KIT",
      score: "48",
      state: "claim",
    },
    {
      alias: "NEON_4",
      rank: "02",
      reward: "WON · VOLT 25% CODE",
      score: "44",
      state: "won",
    },
    {
      alias: "KODA_FIT",
      rank: "03",
      reward: "READY · NOVA SHAKER",
      score: "40",
      state: "ready",
    },
    {
      alias: "IVY_RUN",
      rank: "04",
      reward: "DRAW ELIGIBLE",
      score: "36",
      state: "eligible",
    },
  ] as const;

  return (
    <PhoneShell
      label="GoGymGo leaderboard with brand rewards beside player aliases"
      step="03 // COMPETE"
      title="See who won—and what is ready"
    >
      <div className="mobile-screen-header">
        <span>SAMPLE RESULTS // VANCOUVER</span>
        <strong>4-DAY RANKINGS</strong>
      </div>
      <div className="mobile-rank-summary">
        <div>
          <span>YOUR RANK</span>
          <strong>#04</strong>
        </div>
        <div>
          <span>YOUR SCORE</span>
          <strong>36</strong>
        </div>
      </div>
      <div className="mobile-leaderboard-head">
        <span>PLAYER + BRAND REWARD</span>
        <span>SCORE</span>
      </div>
      <div className="mobile-leaderboard">
        {rows.map((row) => (
          <div className="mobile-rank-row" key={row.rank}>
            <span className="mobile-rank-number">{row.rank}</span>
            <div className="mobile-rank-person">
              <strong>{row.alias}</strong>
              <span className={`reward-state reward-${row.state}`}>
                {row.reward}
              </span>
            </div>
            <strong className="mobile-rank-score">{row.score}</strong>
          </div>
        ))}
      </div>
      <div className="mobile-reward-note">
        <span>BRAND REWARD STATUS</span>
        <strong>VISIBLE BESIDE EACH WINNER</strong>
        <small>Physical prizes + coupon codes. No payment account.</small>
      </div>
    </PhoneShell>
  );
}

export function ProductScreens() {
  return (
    <section className="section product-showcase" id="product">
      <div className="shell">
        <div className="section-heading product-showcase-heading">
          <div>
            <p className="eyebrow">THREE SCREENS. THE COMPLETE LOOP.</p>
            <h2>Commit. Verify. See what you earned.</h2>
          </div>
          <div>
            <p>
              A cleaner look at the core GoGymGo journey—from choosing a
              realistic goal to completing a verified session and seeing
              rankings with brand rewards attached.
            </p>
            <Link className="text-link" href="/demo">
              JOIN A DEMO COMPETITION <span aria-hidden="true">→</span>
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
