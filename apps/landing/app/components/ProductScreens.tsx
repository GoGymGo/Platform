const winnerRows = [
  {
    badge: "+4",
    name: "Chris_Mohan",
    partner: "Northline Wellness",
    prize: "Recovery Pack",
    rank: "01",
  },
  {
    badge: "+3",
    name: "JennyS",
    partner: "Northline Wellness",
    prize: "Training Credit",
    rank: "02",
  },
] as const;

function WinnersCirclePreview() {
  return (
    <div
      aria-label="GoGymGo Winners Circle preview showing Chris_Mohan and JennyS as prize winners"
      className="winners-preview"
      role="img"
    >
      <div aria-hidden="true" className="winners-preview__nav">
        <span>Overview</span>
        <span>Challenge</span>
        <span className="is-active">Winners</span>
        <span>Rewards</span>
      </div>

      <p className="winners-preview__eyebrow">
        Monthly results // Vancouver Island + Gulf Islands
      </p>
      <p className="winners-preview__title">Winners Circle</p>
      <p className="winners-preview__month">July 2026</p>
      <p className="winners-preview__summary">
        Celebrate the seven Weekly Goal champions and the players selected for
        prizes in the regional draw.
      </p>

      <div className="winners-preview__stats">
        <div>
          <strong>7</strong>
          <span>Goal champions</span>
        </div>
        <div>
          <strong>2</strong>
          <span>Prize winners</span>
        </div>
      </div>

      <div aria-hidden="true" className="winners-preview__tabs">
        <span>Goal champions</span>
        <span className="is-active">Prize draw winners</span>
      </div>

      <p className="winners-preview__section-label">Prize draw winners</p>
      <p className="winners-preview__section-copy">
        Every selected player receives the prize shown.
      </p>

      <div className="winners-preview__list">
        {winnerRows.map((winner) => (
          <div className="winners-preview__row" key={winner.rank}>
            <span className="winners-preview__rank">{winner.rank}</span>
            <div className="winners-preview__identity">
              <strong>
                {winner.name}
                <span aria-hidden="true">{winner.badge}</span>
              </strong>
              <small>Prize winner</small>
            </div>
            <div className="winners-preview__prize">
              <strong>{winner.prize}</strong>
              <small>{winner.partner}</small>
            </div>
          </div>
        ))}
        <p>Showing 2 of 2 prize winners.</p>
      </div>
    </div>
  );
}

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
        <p className="product-swipe-hint">SWIPE TO PREVIEW BOTH APP SCREENS →</p>
        <div
          aria-label="Member app screen previews"
          className="product-screen-grid"
          tabIndex={0}
        >
          <article className="product-screen-card">
            <div className="product-phone product-phone--capture">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="GoGymGo active workout screen showing elapsed server time and live verification status"
                className="product-screen-capture"
                decoding="async"
                height={800}
                loading="lazy"
                src="/app/active-workout.webp"
                width={540}
              />
            </div>
            <div className="product-screen-caption">
              <span>01 // VERIFY</span>
              <h3>Follow the authoritative workout timer</h3>
            </div>
          </article>

          <article className="product-screen-card">
            <div className="product-phone product-phone--preview">
              <WinnersCirclePreview />
            </div>
            <div className="product-screen-caption">
              <span>02 // RESULTS</span>
              <h3>Review published competition results</h3>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
