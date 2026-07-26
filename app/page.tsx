import Image from "next/image";
import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Choose your Weekly Goal",
    copy: "Commit to 1–7 verified gym days for the month. Your goal sets the category you compete in.",
  },
  {
    number: "02",
    title: "Complete verified workouts",
    copy: "Use a supported heart-rate device or a partner gym’s entry and exit QR flow. Only approved workouts count.",
  },
  {
    number: "03",
    title: "Build streaks together",
    copy: "Invite friends to Weekly Challenges, join regional Challenges, and keep your consistency visible.",
  },
  {
    number: "04",
    title: "Earn entries, not points",
    copy: "Meet your goal to earn Prize Draw Entries for sponsor-funded physical products and coupon rewards.",
  },
];

const features = [
  {
    eyebrow: "VERIFIED CONSISTENCY",
    title: "Your gym days mean something",
    copy: "GoGymGo reviews real workout evidence before awarding a verified day, streak progress, rank, or Prize Draw Entry.",
    tone: "cyan",
  },
  {
    eyebrow: "FRIENDS + CHALLENGES",
    title: "Accountability without the feed",
    copy: "Pick an eligible friend for a one-week head-to-head Weekly Challenge or create your own activity Challenge.",
    tone: "cyan",
  },
  {
    eyebrow: "REGIONAL COMPETITION",
    title: "Compete at your commitment level",
    copy: "Monthly rankings separate players into 1–7 day Weekly Goal categories so consistency—not free time—leads.",
    tone: "cyan",
  },
  {
    eyebrow: "BRAND REWARDS",
    title: "Rewards worth showing up for",
    copy: "Participating fitness brands supply physical prizes and coupon codes. No purchase, entry fee, wallet, or bank account is required.",
    tone: "pink",
  },
  {
    eyebrow: "CREATOR WORKOUTS",
    title: "Plan your next session",
    copy: "Browse approved creator workouts, add them to your calendar, then complete the standard verification flow for competition credit.",
    tone: "pink",
  },
  {
    eyebrow: "PRIVACY BY DESIGN",
    title: "Proof without public exposure",
    copy: "Aliases can keep identities private. Exact location evidence, health data, contact details, and biometric material are never public profile fields.",
    tone: "green",
  },
];

const brandSignals = [
  "Regional campaigns tied to active fitness participation",
  "Physical-product and coupon reward inventory",
  "Privacy-safe aggregate reach, engagement, and claim reporting",
  "Approved placements across competition and reward moments",
];

export default function Home() {
  return (
    <main>
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            PRE-REGISTRATION OPEN
          </p>
          <h1>
            Consistency
            <br />
            should <span>count.</span>
          </h1>
          <p className="hero-lede">
            GoGymGo turns verified gym attendance into streaks, friend
            challenges, regional competition, and chances to win fitness brand
            rewards.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/gym-goers">
              PRE-REGISTER <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-secondary" href="/brands">
              PARTNER WITH US <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="hero-note">
            No purchase. No entry fee. No payment account. Just verified effort.
          </p>
        </div>

        <div className="hero-visual" aria-label="Preview of the GoGymGo mobile app">
          <div className="signal-card signal-card-top">
            <span>WEEKLY GOAL</span>
            <strong>4 / 4</strong>
            <small>VERIFIED DAYS</small>
          </div>
          <div className="phone phone-primary">
            <Image
              alt="GoGymGo home screen showing a weekly goal, verified workout button, reward, and Weekly Challenge"
              fill
              priority
              sizes="(max-width: 900px) 60vw, 280px"
              src="/app/home.png"
            />
          </div>
          <div className="phone phone-secondary">
            <Image
              alt="GoGymGo Brand Reward marketplace showing sponsor-supplied physical rewards"
              fill
              priority
              sizes="(max-width: 900px) 42vw, 220px"
              src="/app/rewards.png"
            />
          </div>
          <div className="signal-card signal-card-bottom">
            <span>WORKOUT STATUS</span>
            <strong>VERIFIED</strong>
            <small>STREAK UPDATED</small>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="GoGymGo product highlights">
        <div className="shell proof-grid">
          <div>
            <strong>1–7</strong>
            <span>WEEKLY GOAL CATEGORIES</span>
          </div>
          <div>
            <strong>2</strong>
            <span>WORKOUT VERIFICATION PATHS</span>
          </div>
          <div>
            <strong>4</strong>
            <span>SCORING WEEKS EACH MONTH</span>
          </div>
          <div>
            <strong>0</strong>
            <span>PURCHASES REQUIRED</span>
          </div>
        </div>
      </section>

      <section className="section shell" id="how-it-works">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE GOGYMGO LOOP</p>
            <h2>Show up. Prove it. Keep going.</h2>
          </div>
          <p>
            GoGymGo is built around one simple idea: the habit of getting to the
            gym deserves to be recognized.
          </p>
        </div>
        <div className="steps-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-panel">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BUILT FOR THE HABIT</p>
              <h2>More reasons to make the next workout.</h2>
            </div>
            <p>
              Progress stays grounded in server-reviewed workouts while social
              and reward features make consistency easier to sustain.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article
                className={`feature-card tone-${feature.tone}`}
                key={feature.title}
              >
                <p className="feature-eyebrow">{feature.eyebrow}</p>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell app-story">
        <div className="app-story-visual">
          <div className="phone phone-story phone-story-one">
            <Image
              alt="GoGymGo active workout verification screen"
              fill
              sizes="(max-width: 800px) 50vw, 230px"
              src="/app/active-workout.png"
            />
          </div>
          <div className="phone phone-story phone-story-two">
            <Image
              alt="GoGymGo Weekly Challenge screen"
              fill
              sizes="(max-width: 800px) 50vw, 230px"
              src="/app/challenge.png"
            />
          </div>
        </div>
        <div className="app-story-copy">
          <p className="eyebrow">PROOF, NOT PERFORMANCE THEATRE</p>
          <h2>A fairer kind of fitness competition.</h2>
          <p>
            Start with a goal that fits your week. GoGymGo verifies eligible
            sessions, reconciles each result, and only then updates your
            progress.
          </p>
          <ul className="check-list">
            <li>One verified workout can count per regional calendar day.</li>
            <li>Pending or rejected sessions never appear as approved.</li>
            <li>Weekly Challenges happen with friends you choose.</li>
            <li>Rankings compare players in the same Weekly Goal category.</li>
          </ul>
          <Link className="text-link" href="/gym-goers">
            BE FIRST IN YOUR REGION <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="section brand-section">
        <div className="shell brand-layout">
          <div className="brand-copy">
            <p className="eyebrow eyebrow-pink">FOR FITNESS BRANDS</p>
            <h2>Show up where real effort happens.</h2>
            <p>
              GoGymGo gives fitness brands a meaningful role in regional
              competition: fund the rewards, support the habit, and measure
              aggregate participation without targeting private health or
              workout evidence.
            </p>
            <ul className="signal-list">
              {brandSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
            <Link className="button button-pink" href="/brands">
              BECOME A FOUNDING PARTNER <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="brand-console" aria-label="Sample fitness brand campaign">
            <div className="console-header">
              <span>REGIONAL CAMPAIGN</span>
              <span className="console-live">PARTNER INTAKE OPEN</span>
            </div>
            <div className="console-mark">GGG × BRAND</div>
            <div className="console-stats">
              <div>
                <span>REGION</span>
                <strong>LOCAL</strong>
              </div>
              <div>
                <span>REWARD</span>
                <strong>PRODUCT / CODE</strong>
              </div>
            </div>
            <div className="console-placement">
              <span>PLACEMENT MOMENT</span>
              <strong>VERIFIED WORKOUT COMPLETE</strong>
              <div className="console-progress">
                <span />
              </div>
            </div>
            <p>
              Reporting is aggregate and excludes health, biometric, exact
              location, and private social data.
            </p>
          </div>
        </div>
      </section>

      <section className="section shell final-cta">
        <div>
          <p className="eyebrow">READY WHEN YOU ARE</p>
          <h2>Get in before the first competition starts.</h2>
        </div>
        <div className="final-actions">
          <Link className="button button-primary" href="/gym-goers">
            I’M A GYM GOER <span aria-hidden="true">→</span>
          </Link>
          <Link className="button button-secondary" href="/brands">
            I REPRESENT A BRAND <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
