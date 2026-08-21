import { siteLinks } from "../site-links";
import { AppLink } from "./AppLink";

const productScreens = [
  {
    alt: "GoGymGo member join screen showing the gym QR account path, existing-account sign-in, and Partner options",
    height: 899,
    proof: "CANONICAL JOIN",
    proofCopy:
      "Players, existing members, sponsors, and Partner gyms enter through the member experience or reviewed public intake—never a landing-owned account store.",
    src: "/app/join-selection.jpg",
    step: "01 // CHOOSE A PATH",
    title: "Start from one canonical join screen",
    width: 430,
  },
  {
    alt: "GoGymGo public demo directory labeled as a read-only showcase with isolated sample data",
    height: 899,
    proof: "FAKE DATA ONLY",
    proofCopy:
      "The public demo disables Firebase, API, camera, and location access and keeps the exit to real join options separate.",
    src: "/app/public-demo.jpg",
    step: "02 // EXPLORE SAFELY",
    title: "Tour the interface with live services off",
    width: 430,
  },
] as const;

export function ProductScreens() {
  return (
    <section className="section product-showcase" id="product">
      <div className="shell">
        <div className="section-heading product-showcase-heading">
          <div>
            <p className="eyebrow">INSIDE THE MEMBER APP</p>
            <h2>One join path. One isolated product demo.</h2>
          </div>
          <p>
            Registration belongs to the member app. The public demo reuses its
            interface with fake data while live services stay disabled.
          </p>
        </div>
        <div className="product-demo-entry">
          <div>
            <strong>DEMO MODE // ISOLATED SAMPLE DATA</strong>
            <p>
              Explore the shared member interface without creating an account,
              requesting device permissions, or contacting live GoGymGo
              services.
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
        <p className="product-swipe-hint">SWIPE TO PREVIEW BOTH ROUTES →</p>
        <div
          aria-label="Canonical member join and isolated demo previews"
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
