import { redirect } from "next/navigation";
import Link from "next/link";
import { siteLinks } from "../site-links";

export default function DemoPage() {
  if (siteLinks.demo) {
    redirect(siteLinks.demo);
  }

  return (
    <main className="not-found-page">
      <div className="shell not-found-page__content">
        <p className="eyebrow">DEMO // DESTINATION UNAVAILABLE</p>
        <h1>The canonical member-app demo is not configured.</h1>
        <p>
          This public site will not guess or open a preview destination. Return
          home or request Regional updates while the member-app release remains
          unavailable.
        </p>
        <div className="not-found-page__actions">
          <Link className="button button-primary" href={siteLinks.home}>
            RETURN HOME →
          </Link>
          <Link className="button button-secondary" href={siteLinks.regionalUpdates}>
            GET REGIONAL UPDATES →
          </Link>
        </div>
      </div>
    </main>
  );
}
