import Link from "next/link";
import { ProductScreens } from "./components/ProductScreens";
import { siteLinks } from "./site-links";

const steps = [
  {
    number: "01",
    title: "Confirm you are eligible",
    copy: "The September beta is for gym-goers age 19+ on Vancouver Island + Gulf Islands. The app confirms region and current rules before enrollment.",
  },
  {
    number: "02",
    title: "Choose a Weekly Goal",
    copy: "Commit to 1–7 verified workout days per scoring week. Your choice is locked for the September competition.",
  },
  {
    number: "03",
    title: "Verify each workout",
    copy: "At an approved partner gym, scan the same poster on entry and after at least 30 minutes with a fresh location reading.",
  },
];

const features = [
  {
    eyebrow: "ONE NEXT ACTION",
    title: "Know what to do next",
    copy: "Home surfaces the next unfinished setup or workout action instead of making you search for it.",
    tone: "cyan",
  },
  {
    eyebrow: "FAIR GOAL GROUPS",
    title: "Compare like with like",
    copy: "Regional rankings separate players by their 1–7 day Weekly Goal so each commitment has its own context.",
    tone: "cyan",
  },
  {
    eyebrow: "SOCIAL MOTIVATION",
    title: "Build the habit together",
    copy: "Connect with friends, build streaks, and take part in eligible one-week challenges.",
    tone: "green",
  },
  {
    eyebrow: "PUBLISHED RESULTS",
    title: "See the outcome clearly",
    copy: "Competition status, results, and reward information stay visible in the app instead of relying on guesswork.",
    tone: "pink",
  },
];

const brandSignals = [
  "Approved regional placements tied to verified fitness participation",
  "Physical-product or coupon inventory with published terms",
  "Aggregate reporting that excludes private workout evidence and exact location",
];

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    logo: "https://gogymgo.com/mark.svg",
    name: "GoGymGo",
    url: "https://gogymgo.com",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    description:
      "Verified partner-gym workouts, Weekly Goals, regional competition, social challenges, and published rewards.",
    name: "GoGymGo",
    url: "https://gogymgo.com",
  },
];

function SeptemberChallengePanel() {
  return (
    <aside
      aria-label="September 2026 beta challenge details"
      className="pilot-console"
    >
      <div className="pilot-console__header">
        <span>SEPTEMBER 2026 BETA</span>
        <b>REGISTRATION OPEN</b>
      </div>
      <div className="pilot-console__reward">
        <span>ONE PUBLISHED REWARD</span>
        <strong>$100 CAD</strong>
        <p>Sponsored by GoGymGo</p>
      </div>
      <dl className="pilot-console__facts">
        <div>
          <dt>ELIGIBLE REGION</dt>
          <dd>Vancouver Island + Gulf Islands</dd>
        </div>
        <div>
          <dt>MINIMUM AGE</dt>
          <dd>19+</dd>
        </div>
        <div>
          <dt>WEEKLY GOAL</dt>
          <dd>1–7 days</dd>
        </div>
        <div>
          <dt>VERIFIED SESSION</dt>
          <dd>30+ minutes</dd>
        </div>
      </dl>
      <p className="pilot-console__note">
        The app confirms location, eligibility, published legal documents, and
        competition availability before enrollment.
      </p>
    </aside>
  );
}

export default function Home() {
  return (
    <main className="landing-page">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />

      <section className="landing-hero shell">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            SEPTEMBER 2026 BETA // REGISTRATION OPEN
          </p>
          <h1>
            Make consistency <span>count.</span>
          </h1>
          <p className="hero-lede">
            Eligible gym-goers age 19+ on Vancouver Island + Gulf Islands can
            join the free September beta and compete for one $100 CAD reward
            sponsored by GoGymGo.
          </p>
          <div className="hero-actions">
            <Link
              className="button button-primary"
              href={siteLinks.memberApp}
            >
              JOIN THE SEPTEMBER BETA <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="button button-secondary"
              href={siteLinks.gymGoers}
            >
              GET REGIONAL UPDATES <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="hero-note">
            NO PURCHASE REQUIRED // APPROVED PARTNER GYM REQUIRED // REGIONAL
            RULES APPLY
          </p>
        </div>
        <SeptemberChallengePanel />
      </section>

      <section
        aria-label="September beta at a glance"
        className="proof-strip"
      >
        <div className="shell proof-grid">
          <div>
            <strong>19+</strong>
            <span>MINIMUM ELIGIBLE AGE</span>
          </div>
          <div>
            <strong>1–7</strong>
            <span>WEEKLY GOAL DAYS</span>
          </div>
          <div>
            <strong>30:00</strong>
            <span>VERIFIED MINIMUM</span>
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
            <h2>Three steps from eligibility to a verified workout.</h2>
          </div>
          <p>
            Registration and competition eligibility are confirmed in the app.
            Joining the regional update list does not register you for the beta.
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

      <section className="section section-panel">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">BUILT FOR CLARITY</p>
              <h2>Know what counts and what happens next.</h2>
            </div>
            <p>
              GoGymGo separates setup, workout verification, social motivation,
              results, and rewards so each state has one clear next action.
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
              The September pilot reward is sponsored by GoGymGo. We are also
              preparing future, approved regional campaigns with fitness brands
              that can supply real product or coupon inventory.
            </p>
            <ul className="signal-list">
              {brandSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
            <Link className="button button-pink" href={siteLinks.brands}>
              EXPLORE A FOUNDING PARTNERSHIP <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div
            aria-label="Example future brand reward placement"
            className="brand-console"
          >
            <div className="console-header">
              <span>FUTURE CAMPAIGN MODEL</span>
              <span className="console-live">PARTNER INTAKE OPEN</span>
            </div>
            <div className="console-mark">PLAYER × BRAND</div>
            <div className="console-stats">
              <div>
                <span>REGION</span>
                <strong>APPROVED CAMPAIGN</strong>
              </div>
              <div>
                <span>REWARD</span>
                <strong>PRODUCT / COUPON</strong>
              </div>
            </div>
            <div className="console-placement">
              <span>PLAYER STATE</span>
              <strong>PUBLISHED IN THE APP</strong>
              <div className="console-progress">
                <span />
              </div>
            </div>
            <p>
              Reporting is aggregate and excludes health data, exact location,
              private social data, and private workout evidence.
            </p>
          </div>
        </div>
      </section>

      <section className="section shell final-cta">
        <div>
          <p className="eyebrow">CHOOSE THE RIGHT NEXT STEP</p>
          <h2>Eligible now, waiting for your region, or representing a brand?</h2>
        </div>
        <div className="final-actions">
          <Link className="button button-primary" href={siteLinks.memberApp}>
            JOIN SEPTEMBER BETA <span aria-hidden="true">→</span>
          </Link>
          <Link className="button button-secondary" href={siteLinks.gymGoers}>
            GET REGIONAL UPDATES <span aria-hidden="true">→</span>
          </Link>
          <Link className="button button-secondary" href={siteLinks.brands}>
            EXPLORE PARTNERSHIPS <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
