const productScreens = [
  {
    src: "/app/weekly-goal.png",
    alt: "Production GoGymGo Weekly Goal screen with a seven-day goal selected",
    height: 1040,
    width: 540,
    step: "01 // COMMIT",
    title: "Choose a goal you can repeat",
  },
  {
    src: "/app/active-workout.png",
    alt: "Production GoGymGo active workout screen with live heart-rate verification",
    height: 800,
    width: 540,
    step: "02 // VERIFY",
    title: "Complete the 30-minute timer",
  },
  {
    src: "/app/winners-circle.png",
    alt: "Production GoGymGo Winners Circle showing verified prize-draw results",
    height: 800,
    width: 540,
    step: "03 // RESULTS",
    title: "See the Winners Circle results",
  },
] as const;

export function ProductScreens() {
  return (
    <section className="section product-showcase" id="product">
      <div className="shell">
        <div className="section-heading product-showcase-heading">
          <div>
            <p className="eyebrow">PRODUCTION MEMBER APP SCREENS</p>
            <h2>The same screens players use in the app.</h2>
          </div>
          <div>
            <p>
              These captures come directly from app.gogymgo.com and preserve
              each complete screen: set a Weekly Goal, verify a live workout,
              and review the Winners Circle results.
            </p>
          </div>
        </div>
        <div className="product-screen-grid">
          {productScreens.map((screen) => (
            <article className="product-screen-card" key={screen.src}>
              <div className="product-phone product-phone--capture">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={screen.alt}
                  className="product-screen-capture"
                  decoding="async"
                  height={screen.height}
                  loading={screen.src === "/app/weekly-goal.png" ? "eager" : "lazy"}
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
