const productScreens = [
  {
    alt: "GoGymGo active workout screen showing elapsed server time and live verification status",
    height: 800,
    src: "/app/active-workout.webp",
    step: "01 // VERIFY",
    title: "Follow the authoritative workout timer",
    width: 540,
  },
  {
    alt: "GoGymGo Winners Circle screen showing published competition results",
    height: 800,
    src: "/app/winners-circle.webp",
    step: "02 // RESULTS",
    title: "Review published competition results",
    width: 540,
  },
] as const;

export function ProductScreens() {
  return (
    <section className="section product-showcase" id="product">
      <div className="shell">
        <div className="section-heading product-showcase-heading">
          <div>
            <p className="eyebrow">INSIDE THE MEMBER APP</p>
            <h2>From verified workout to published result.</h2>
          </div>
          <p>
            The app keeps live verification separate from final competition
            results, so pending activity is never presented as approved credit.
          </p>
        </div>
        <p className="product-swipe-hint">SWIPE TO PREVIEW BOTH APP SCREENS â†’</p>
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
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
