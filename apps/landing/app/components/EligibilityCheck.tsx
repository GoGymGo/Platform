"use client";

import { FormEvent, useState } from "react";
import { septemberCampaign } from "../campaign";
import { recordPublicSiteEvent } from "../public-site-events";
import { siteLinks } from "../site-links";
import { AppLink } from "./AppLink";

type Answer = "yes" | "no" | "unsure" | null;
type Result = "likely" | "not-eligible" | "needs-confirmation" | null;

const sharedAnswers = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
  { label: "Not sure", value: "unsure" },
] as const;

function AnswerOptions({
  answers = sharedAnswers,
  name,
}: {
  answers?: readonly { label: string; value: Exclude<Answer, null> }[];
  name: string;
}) {
  return (
    <div
      className={`eligibility-options${answers.length === 2 ? " eligibility-options--two" : ""}`}
    >
      {answers.map((answer) => (
        <label key={answer.value}>
          <input name={name} required type="radio" value={answer.value} />
          <span>{answer.label}</span>
        </label>
      ))}
    </div>
  );
}

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
          <h2 id="eligibility-check-title">See if the September basics fit.</h2>
          <p className="eligibility-availability-note">
            This private on-page check is not saved and does not register you.
            GoGymGo has not published a public partner-gym directory; only a
            gym with an active GoGymGo poster can qualify. The app makes the
            final decision using current availability, location, and legal
            requirements.
          </p>
        </div>

        <form className="eligibility-check" onSubmit={onSubmit}>
          <fieldset className="eligibility-question">
            <legend>Are you {septemberCampaign.minimumAge} or older?</legend>
            <AnswerOptions
              answers={[
                { label: "Yes", value: "yes" },
                { label: "No", value: "no" },
              ]}
              name="age"
            />
          </fieldset>
          <fieldset className="eligibility-question">
            <legend>
              Will you be on Vancouver Island or an included Gulf Island?
            </legend>
            <AnswerOptions name="region" />
          </fieldset>
          <fieldset className="eligibility-question">
            <legend>Can you use a gym with an active GoGymGo poster?</legend>
            <AnswerOptions name="partnerGym" />
          </fieldset>
          <button className="button button-primary" type="submit">
            CHECK MY ANSWERS
          </button>

          {result ? (
            <div
              aria-live="polite"
              className={`eligibility-result eligibility-result--${result}`}
            >
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
                    future-region updates.
                  </p>
                  <a
                    className="button button-secondary"
                    data-analytics-event="regional_updates_click"
                    href={siteLinks.regionalUpdates}
                  >
                    GET FUTURE-REGION UPDATES ↓
                  </a>
                </>
              ) : null}
              {result === "needs-confirmation" ? (
                <>
                  <h3>One or more details still need confirmation.</h3>
                  <p>
                    Review the included-islands list and use the app to check
                    current partner-poster availability.
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
