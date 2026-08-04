"use client";

import { FormEvent, useState } from "react";
import { septemberCampaign } from "../campaign";
import { recordPublicSiteEvent } from "../public-site-events";
import { siteLinks } from "../site-links";
import { AppLink } from "./AppLink";

type Answer = "" | "yes" | "no" | "unsure";
type Result = "likely" | "not-eligible" | "needs-confirmation" | null;

export function EligibilityCheck() {
  const [result, setResult] = useState<Result>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const age = formData.get("age") as Answer;
    const region = formData.get("region") as Answer;
    const partnerGym = formData.get("partnerGym") as Answer;

    if (age === "no" || region === "no") {
      setResult("not-eligible");
    } else if (age === "yes" && region === "yes" && partnerGym === "yes") {
      setResult("likely");
    } else {
      setResult("needs-confirmation");
    }

    recordPublicSiteEvent("eligibility_check_completed");
  }

  return (
    <section
      aria-labelledby="eligibility-check-title"
      className="section eligibility-section"
      id="eligibility-check"
    >
      <div className="shell eligibility-layout">
        <div className="eligibility-intro">
          <p className="eyebrow">ELIGIBILITY // QUICK CHECK</p>
          <h2 id="eligibility-check-title">
            Check the basics before opening the app.
          </h2>
          <p>
            This private on-page check is not saved and does not register you.
            The member app makes the final eligibility decision using current
            campaign, location, legal-document, and partner-gym status.
          </p>
          <p className="eligibility-availability-note">
            GoGymGo has not published a public partner-gym directory. Only a gym
            displaying an active GoGymGo poster can support the September
            verification flow.
          </p>
        </div>

        <form className="eligibility-check" onSubmit={onSubmit}>
          <div className="eligibility-question">
            <label htmlFor="eligibility-age">
              Will you be at least {septemberCampaign.minimumAge} when you
              register?
            </label>
            <select defaultValue="" id="eligibility-age" name="age" required>
              <option disabled value="">Select one</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="eligibility-question">
            <label htmlFor="eligibility-region">
              Will you be physically located on Vancouver Island or an included
              Gulf Island when region verification occurs?
            </label>
            <select defaultValue="" id="eligibility-region" name="region" required>
              <option disabled value="">Select one</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unsure">I am not sure</option>
            </select>
          </div>
          <div className="eligibility-question">
            <label htmlFor="eligibility-partner-gym">
              Can you use a gym displaying an active GoGymGo partner poster?
            </label>
            <select
              defaultValue=""
              id="eligibility-partner-gym"
              name="partnerGym"
              required
            >
              <option disabled value="">Select one</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="unsure">I am not sure</option>
            </select>
          </div>
          <button className="button button-primary" type="submit">
            CHECK THE BASICS
          </button>

          {result ? (
            <div aria-live="polite" className={`eligibility-result eligibility-result--${result}`}>
              {result === "likely" ? (
                <>
                  <h3>Your answers match the published basics.</h3>
                  <p>
                    The app still confirms current availability, precise
                    location, accepted legal documents, and the active partner
                    poster before enrollment succeeds.
                  </p>
                  <AppLink
                    analyticsEvent="member_app_click"
                    className="button button-primary"
                    href={siteLinks.memberApp}
                  >
                    CONTINUE TO REGISTRATION
                  </AppLink>
                </>
              ) : null}
              {result === "not-eligible" ? (
                <>
                  <h3>The September basics do not match your answers.</h3>
                  <p>
                    The September beta requires age {septemberCampaign.minimumAge}+
                    and an eligible physical location. You can still request
                    regional launch updates.
                  </p>
                  <a
                    className="button button-secondary"
                    data-analytics-event="regional_updates_click"
                    href={siteLinks.regionalUpdates}
                  >
                    GET REGIONAL UPDATES ↓
                  </a>
                </>
              ) : null}
              {result === "needs-confirmation" ? (
                <>
                  <h3>One or more details still need confirmation.</h3>
                  <p>
                    Review the included-islands list and use the app to check
                    current partner availability. A public partner-gym list is
                    not available.
                  </p>
                  <div className="eligibility-result__actions">
                    <a className="button button-secondary" href="/faq#faq-joining">
                      REVIEW ELIGIBLE REGIONS →
                    </a>
                    <AppLink
                      analyticsEvent="member_app_click"
                      className="button button-primary"
                      href={siteLinks.memberApp}
                    >
                      CHECK IN THE APP
                    </AppLink>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
