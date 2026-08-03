const productScreens = [
  {
    src: "/app/weekly-goal.png",
    alt: "GoGymGo member app screen with a four-day Weekly Goal selected",
    step: "01 // COMMIT",
    title: "Choose a goal you can repeat",
  },
  {
    src: "/app/train.png",
    alt: "GoGymGo member app screen for verifying a gym visit",
    step: "02 // VERIFY",
    title: "Verify each gym visit",
  },
  {
    src: "/app/competition.png",
    alt: "GoGymGo member app Regional Competition overview screen",
    step: "03 // COMPETE",
    title: "Track your regional standing",
  },
] as const;

export function ProductScreens() {
  return (
    <section className="section product-showcase" id="product">
      <div className="shell">
        <div className="section-heading product-showcase-heading">
          <div>
            <p className="eyebrow">REAL MEMBER APP SCREENS</p>
            <h2>The actual flow players use.</h2>
          </div>
          <div>
            <p>
              These are live captures from the member app: choose a Weekly
              Goal, verify a gym visit, and follow the regional competition.
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
                  height={886}
                  loading={
                    screen.src === "/app/weekly-goal.png" ? "eager" : "lazy"
                  }
                  src={screen.src}
                  width={430}
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
