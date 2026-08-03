function ScreenHeader({ label, step }: { label: string; step: string }) {
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
      label="GoGymGo Weekly Goal screen with all four-day goal details visible"
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
      <div className="app-publication-note">
        <strong>PUBLISHED COMPETITION</strong>
        <span>Enrollment closes August 31. Entries begin when confirmed.</span>
      </div>
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
      </div>
      <div className="app-confirmation-row">
        <span aria-hidden="true">✓</span>
        <p>I accept the competition rules and lock my 4-day goal.</p>
      </div>
      <div className="app-primary-action">CONFIRM 4-DAY GOAL</div>
    </PhoneShell>
  );
}

function TimerScreen() {
  return (
    <PhoneShell
      label="GoGymGo active workout screen with the complete timer and session status visible"
      step="02 // VERIFY"
      title="Complete the 30-minute timer"
    >
      <div className="app-session-heading">
        <span>
          <i />
          SESSION TRACKING
        </span>
        <strong>SESSION ACTIVE</strong>
      </div>
      <div className="app-hud app-timer-panel">
        <span>ELAPSED</span>
        <strong>18:42</strong>
        <small>OF 30:00 MINIMUM</small>
        <div className="app-workout-progress">
          <span style={{ width: "62%" }} />
        </div>
        <div className="app-workout-labels">
          <span>START</span>
          <span>CHECK</span>
          <span>END</span>
        </div>
      </div>
      <div className="app-session-metrics">
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
      <div className="app-session-statuses">
        <div>
          <span>EFFORT</span>
          <strong>HEART RATE ON TRACK</strong>
        </div>
        <div>
          <span>PRESENCE CHECK</span>
          <strong>AUTOMATIC AT 30:00</strong>
        </div>
        <div>
          <span>SESSION SAVE</span>
          <strong>AUTO-SAVED</strong>
        </div>
      </div>
      <div className="app-disabled-action">FINISH UNLOCKS AT 30:00</div>
      <div className="app-danger-action">END SESSION</div>
      <div className="app-secondary-action">GO TO HOME // SESSION CONTINUES</div>
    </PhoneShell>
  );
}

const goalChampions = [
  { alias: "NORTH_STAR", goal: "1", score: "84" },
  { alias: "PULSE_RIDER", goal: "4", score: "72" },
] as const;

const prizeWinners = [
  {
    alias: "NORTH_STAR",
    rank: "01",
    reward: "RECOVERY PACK",
    sponsor: "NORTHLINE WELLNESS",
  },
  {
    alias: "MOVE_MORE",
    rank: "02",
    reward: "TRAINING CREDIT",
    sponsor: "NORTHLINE WELLNESS",
  },
] as const;

function WinnersCircleScreen() {
  return (
    <PhoneShell
      label="GoGymGo Winners Circle showing monthly goal champions and prize draw results"
      step="03 // RESULTS"
      title="Celebrate the Winners Circle"
    >
      <div className="app-competition-tabs" aria-label="Competition navigation">
        <span>OVERVIEW</span>
        <span>CHALLENGE</span>
        <span className="is-active">WINNERS</span>
        <span>REWARDS</span>
      </div>
      <div className="app-results-heading">
        <span>MONTHLY RESULTS // TORONTO</span>
        <h4>WINNERS CIRCLE</h4>
        <p>JULY 2026</p>
        <small>
          Goal champions and verified prize-draw winners from the completed
          regional competition.
        </small>
      </div>
      <div className="app-hud app-results-summary">
        <div>
          <strong>7</strong>
          <span>GOAL CHAMPIONS</span>
        </div>
        <div>
          <strong>2</strong>
          <span>REWARD WINNERS</span>
        </div>
      </div>
      <div className="app-result-tabs" aria-label="Results categories">
        <span className="is-active">GOAL CHAMPIONS</span>
        <span>PRIZE DRAW WINNERS</span>
      </div>
      <div className="app-results-section-heading">
        <strong>GOAL CHAMPIONS</strong>
        <span>HIGHEST SETTLED SCORE BY GOAL GROUP</span>
      </div>
      <div className="app-results-list app-results-list--compact">
        {goalChampions.map((winner) => (
          <div className="app-result-row app-result-row--champion" key={winner.goal}>
            <span>{winner.goal} DAY</span>
            <div>
              <strong>{winner.alias}</strong>
              <small>GOAL CHAMPION</small>
            </div>
            <b>{winner.score} SCORE</b>
          </div>
        ))}
      </div>
      <div className="app-results-section-heading app-results-section-heading--pink">
        <strong>PRIZE DRAW WINNERS</strong>
        <span>VERIFIED REWARD RESULTS</span>
      </div>
      <div className="app-results-list app-results-list--compact">
        {prizeWinners.map((winner) => (
          <div className="app-result-row" key={winner.rank}>
            <span>{winner.rank}</span>
            <div>
              <strong>{winner.alias}</strong>
              <small>{winner.reward}</small>
            </div>
            <b>{winner.sponsor}</b>
          </div>
        ))}
      </div>
      <p className="app-results-note">
        Sample audited results shown for the member-app preview.
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
            <p className="eyebrow">HIGH-FIDELITY APP PREVIEWS</p>
            <h2>The complete flow, rendered clearly.</h2>
          </div>
          <div>
            <p>
              Every preview is drawn from the member app interface at full
              browser resolution, so the complete state stays sharp and
              readable on every screen.
            </p>
          </div>
        </div>
        <div className="product-screen-grid">
          <GoalScreen />
          <TimerScreen />
          <WinnersCircleScreen />
        </div>
      </div>
    </section>
  );
}
