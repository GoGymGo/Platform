import type { Metadata } from "next";
import Link from "next/link";
import { AppLink } from "../components/AppLink";
import { siteLinks } from "../site-links";

export const metadata: Metadata = {
  alternates: { canonical: "/account-deletion" },
  description:
    "Request deletion of a GoGymGo account from the browser and understand what happens after a verified request.",
  title: "Account deletion",
};

export default function AccountDeletionPage() {
  return (
    <main className="info-page">
      <div className="shell info-page__shell info-page__shell--narrow">
        <header className="info-page__header">
          <p className="eyebrow">PRIVACY // ACCOUNT DELETION</p>
          <h1>Request account deletion from any browser.</h1>
          <p>
            You do not need to reinstall the GoGymGo mobile app. Sign in to the
            browser member app to create an authenticated deletion request.
          </p>
        </header>

        <div className="prose-stack">
          <section>
            <h2>Submit a verified request</h2>
            <ol>
              <li>Open Account Data in the GoGymGo browser app.</li>
              <li>Sign in to the account you want deleted.</li>
              <li>
                Select account deletion and explicitly confirm
                DELETE_MY_ACCOUNT.
              </li>
              <li>Return to Account Data to review the request status.</li>
            </ol>
            <AppLink
              className="button button-primary"
              href={siteLinks.accountData}
            >
              OPEN ACCOUNT DATA →
            </AppLink>
          </section>

          <section>
            <h2>Local reset is not account deletion</h2>
            <p>
              “Sign out and clear local data” removes only GoGymGo-owned state
              from that device, including the local session and cached recovery
              data. It does not submit a deletion request or erase server-side
              account, contest, workout, reward, or legal records.
            </p>
          </section>

          <section>
            <h2>If request processing is unavailable</h2>
            <p>
              Account Data will say when privacy operations are disabled or
              unavailable. In that state no request has been submitted; retry
              later after the service reports that request creation is enabled.
            </p>
          </section>

          <section>
            <h2>If you cannot sign in</h2>
            <p>
              Reset your password in the browser, then return to Account Data.
              GoGymGo must verify that the request belongs to the account owner
              before processing deletion.
            </p>
            <AppLink
              className="button button-secondary"
              href={siteLinks.forgotPassword}
            >
              RESET PASSWORD →
            </AppLink>
          </section>

          <section>
            <h2>What deletion does</h2>
            <p>
              An approved request removes or de-identifies the active account,
              profile, media, notification, and social information covered by
              the current GoGymGo Privacy Policy. Limited pseudonymous records
              may be retained when required for contest integrity, fraud
              prevention, reward disputes, legal receipts, or applicable law.
            </p>
            <p>
              An active contest, unresolved reward claim, legal hold, or
              identity-verification problem may delay processing. The request
              status remains available in Account Data while the account can
              still be accessed.
            </p>
          </section>

          <section className="info-cta">
            <h2>Review the full policy</h2>
            <p>
              The current Privacy Policy explains GoGymGo data categories,
              safeguards, retention, access, correction, export, and deletion
              rights.
            </p>
            <AppLink className="text-link" href={siteLinks.privacy}>
              READ THE PRIVACY POLICY →
            </AppLink>
          </section>

          <p className="fine-print">Last updated August 20, 2026.</p>
          <p className="fine-print">
            Never send a password, authentication code, precise workout
            location, or reward code through a public contact channel. For a
            public-site accessibility problem, use the{" "}
            <Link href={siteLinks.publicSiteHelp}>
              public-site feedback form
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
