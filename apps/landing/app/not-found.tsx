import Link from "next/link";
import { siteLinks } from "./site-links";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="shell not-found-page__content">
        <p className="eyebrow">404 // ROUTE NOT FOUND</p>
        <h1>That page is not part of GoGymGo.</h1>
        <p>
          The link may be old or incomplete. Return to the public site, check
          the September beta details, or find regional updates.
        </p>
        <div className="not-found-page__actions">
          <Link className="button button-primary" href={siteLinks.home}>
            RETURN HOME →
          </Link>
          <Link className="button button-secondary" href={siteLinks.faq}>
            READ THE FAQ →
          </Link>
          <Link className="button button-secondary" href={siteLinks.gymGoers}>
            GET REGIONAL UPDATES →
          </Link>
        </div>
      </div>
    </main>
  );
}
