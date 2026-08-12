import { siteLinks } from "../site-links";
import { AppLink } from "./AppLink";

const productScreens = [
  {
    alt: "GoGymGo active workout screen showing elapsed server time and live verification status",
    height: 1600,
    proof: "LIVE VERIFICATION",
    proofCopy:
      "Server-timed progress with live heart-rate verification and automatic session saving.",
    src: "/app/active-workout.webp",
    step: "01 // VERIFY",
    title: "Follow the authoritative workout timer",
    width: 960,
  },
  {
    alt: "GoGymGo Winners Circle screen showing published contest results",
    height: 1600,
    proof: "PUBLISHED ONLY",
    proofCopy:
      "Final standings appear only after submitted activity is reviewed.",
    src: "/app/winners-circle.webp",
    step: "02 // RESULTS",
    title: "Review published contest results",
    width: 960,
  },
] as const;

export function ProductScreens() {
  return (
    <section className="section product-showcase" id="product">
      <div className="shell">
        <div className="section-heading product-showcase-heading">
          <div>
            <p className="eyebrow">INSIDE THE MEMBER APP</p>
            <h2>From Verified workout to published result.</h2>
          </div>
          <p>
            The app keeps live verification separate from final contest
            results, so pending activity is never presented as approved credit.
          </p>
        </div>
        <div className="product-demo-entry">
          <div>
            <strong>DEMO MODE // ISOLATED SAMPLE DATA</strong>
            <p>
              Explore the real browser, iPhone, and Android interface without
              creating an account or contacting live GoGymGo services.
            </p>
          </div>
          <AppLink
            analyticsEvent="demo_click"
            className="button button-secondary"
            href={siteLinks.demo}
          >
            OPEN THE INTERACTIVE DEMO
          </AppLink>
        </div>
        <p className="product-swipe-hint">SWIPE TO PREVIEW BOTH APP SCREENS →</p>
        <div
          aria-label="Member app screen previews"
          className="product-screen-grid"
          tabIndex={0}
        >
          {productScreens.map((screen) => (
            <article className="product-screen-card" key={screen.src}>
              <div className="product-phone product-phone--capture">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={screen.alt}
                  className="product-screen-capture"
                  decoding="async"
                  height={screen.height}
                  loading="lazy"
                  src={screen.src}
                  width={screen.width}
                />
              </div>
              <div className="product-screen-caption">
                <span>{screen.step}</span>
                <h3>{screen.title}</h3>
                <p className="product-screen-callout">
                  <strong>{screen.proof}</strong>
                  {screen.proofCopy}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
