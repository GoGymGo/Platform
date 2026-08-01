import Link from "next/link";
import { ProductScreens } from "./components/ProductScreens";

const steps = [
  {
    number: "01",
    title: "Set your Weekly Goal",
    copy: "Choose 1–7 verified workout days you can realistically repeat each week.",
  },
  {
    number: "02",
    title: "Verify each workout",
    copy: "Follow one guided timer using an eligible heart-rate device or a partner gym QR flow.",
  },
  {
    number: "03",
    title: "Compete for brand rewards",
    copy: "Track your regional standing, earn Prize Draw Entries, and claim published rewards if you win.",
  },
];

const features = [
  {
    eyebrow: "ONE NEXT ACTION",
    title: "Always know what to do",
    copy: "Home surfaces the next unfinished setup or workout action instead of making you search for it.",
    tone: "cyan",
  },
  {
    eyebrow: "FAIR GOAL GROUPS",
    title: "Compete at your level",
    copy: "Rankings separate players by their 1–7 day Weekly Goal so consistency leads the competition.",
    tone: "cyan",
  },
  {
    eyebrow: "WEEKLY CHALLENGES",
    title: "Build the habit together",
    copy: "Invite an eligible friend to a one-week challenge and keep each other moving.",
    tone: "green",
  },
  {
    eyebrow: "BRAND REWARDS",
    title: "See exactly what you can win",
    copy: "Physical products and coupon rewards are published with clear winner and claim states.",
    tone: "pink",
  },
];

const brandSignals = [
  "Regional campaigns connected to verified fitness participation",
  "Physical-product and coupon reward inventory",
  "Privacy-safe aggregate reach, engagement, and claim reporting",
];

function HeroAppPreview() {
  return (
    <div className="hero-app-preview" aria-label="Preview of the GoGymGo Home screen">
      <div className="hero-app-status">
        <span>ACCOUNT READY // VANCOUVER</span>
        <b>CA</b>
      </div>
      <strong className="hero-app-alias">CAMERON12</strong>
      <div className="hero-app-card">
        <span>WEEK 1 // READY</span>
        <h2>START YOUR FIRST SESSION</h2>
        <p>
          Complete 4 verified workouts this week to hit your Weekly Goal.
        </p>
        <div className="hero-app-goal">
          <strong>4</strong>
          <span>DAY GOAL</span>
        </div>
        <div className="hero-app-button">START WORKOUT →</div>
      </div>
      <div className="hero-app-nav" aria-hidden="true">
        <span className="is-active">HOME</span>
        <span>LOG</span>
        <span>TRAIN</span>
        <span>COMPETE</span>
        <span>ME</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="landing-page">
      <section className="landing-hero shell">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            SYSTEM ONLINE // PRE-REGISTRATION OPEN
          </p>
          <h1>
            Make consistency <span>count.</span>
          </h1>
          <p className="hero-lede">
            Complete verified workouts, compete in your region and earn chances
            to win fitness brand rewards.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/demo">
              TRY THE APP FLOW <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-secondary" href="/gym-goers">
              PRE-REGISTER <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="hero-note">
            FREE TO PLAY // FUNDED BY SPONSORS // NO PAYMENT ACCOUNT
          </p>
        </div>
        <HeroAppPreview />
      </section>

      <section className="proof-strip" aria-label="GoGymGo product highlights">
        <div className="shell proof-grid">
          <div>
            <strong>1–7</strong>
            <span>WEEKLY GOAL GROUPS</span>
          </div>
          <div>
            <strong>30:00</strong>
            <span>VERIFIED WORKOUT MINIMUM</span>
          </div>
          <div>
            <strong>4</strong>
            <span>SCORING WEEKS</span>
          </div>
          <div>
            <strong>$0</strong>
            <span>ENTRY COST</span>
          </div>
        </div>
      </section>

      <section className="section shell" id="how-it-works">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HOW GOGYMGO WORKS</p>
            <h2>A short loop you can understand at a glance.</h2>
          </div>
          <p>
            Set one goal, complete verified workouts, and see your progress
            update. Everything else supports that loop.
          </p>
        </div>
        <div className="steps-grid landing-steps">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <ProductScreens />

      <section className="section shell demo-promo">
        <div>
          <p className="eyebrow">
            <span className="status-dot" />
            INTERACTIVE APP WALKTHROUGH
          </p>
          <h2>Use the flow before you register.</h2>
          <p>
            Move through the same setup, Weekly Goal, workout, completion, and
            results screens as the mobile app. It stays on your device and
            never creates a real account or competition entry.
          </p>
          <Link className="button button-primary" href="/demo">
            OPEN THE APP DEMO <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="demo-promo-sequence" aria-label="Three parts of the app demo">
          <div>
            <span>01</span>
            <strong>SET UP</strong>
            <small>Region + Weekly Goal</small>
          </div>
          <div>
            <span>02</span>
            <strong>VERIFY</strong>
            <small>Method + active timer</small>
          </div>
          <div>
            <span>03</span>
            <strong>COMPETE</strong>
            <small>Results + rewards</small>
          </div>
        </div>
      </section>

      <section className="section section-panel">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BUILT FOR CLARITY</p>
              <h2>Less noise around the habit.</h2>
            </div>
            <p>
              The desktop experience now follows the same visual and language
              system as the improved app.
            </p>
          </div>
          <div className="feature-grid landing-feature-grid">
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

      <section className="section brand-section">
        <div className="shell brand-layout">
          <div className="brand-copy">
            <p className="eyebrow eyebrow-pink">FOR FITNESS BRANDS</p>
            <h2>Support the habit. Reward the effort.</h2>
            <p>
              Become part of regional competition with rewards players can see,
              understand, and claim through the app.
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
          <div className="brand-console" aria-label="Example brand reward placement">
            <div className="console-header">
              <span>REWARD PLACEMENT</span>
              <span className="console-live">PARTNER INTAKE OPEN</span>
            </div>
            <div className="console-mark">PLAYER × BRAND</div>
            <div className="console-stats">
              <div>
                <span>REGION</span>
                <strong>VANCOUVER</strong>
              </div>
              <div>
                <span>REWARD</span>
                <strong>PRODUCT / CODE</strong>
              </div>
            </div>
            <div className="console-placement">
              <span>PLAYER STATE</span>
              <strong>READY TO CLAIM</strong>
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
          <h2>See the app. Then choose how you want to join.</h2>
        </div>
        <div className="final-actions">
          <Link className="button button-primary" href="/demo">
            TRY THE APP FLOW <span aria-hidden="true">→</span>
          </Link>
          <Link className="button button-secondary" href="/gym-goers">
            I&apos;M A GYM GOER <span aria-hidden="true">↗</span>
          </Link>
          <Link className="button button-secondary" href="/brands">
            I REPRESENT A BRAND <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
