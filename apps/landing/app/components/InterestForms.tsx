"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { siteLinks } from "../site-links";
import { AppLink } from "./AppLink";

type FormState = "idle" | "submitting" | "success" | "error";

function readErrorMessage(error: unknown, fallbackError: string) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallbackError;
}

async function submitInterest(
  form: HTMLFormElement,
  fallbackError: string,
) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(
    Array.from(formData.entries()).filter(([, value]) => {
      return typeof value !== "string" || value.trim().length > 0;
    }),
  );
  const response = await fetch("/api/interest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...payload,
      audience: "brand",
      consent: formData.get("consent") === "on",
    }),
  });

  let body: { error?: string } = {};
  try {
    body = (await response.json()) as { error?: string };
  } catch {
    // Some upstream failures have no JSON body. Keep the message user-safe.
  }

  if (!response.ok) {
    throw new Error(body.error ?? fallbackError);
  }
}

async function submitRegionalUpdates(
  form: HTMLFormElement,
  fallbackError: string,
) {
  const formData = new FormData(form);
  const response = await fetch("/api/regional-updates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contactFax: formData.get("contactFax"),
      email: formData.get("email"),
      requestedRegion: formData.get("region"),
    }),
  });

  let body: { error?: string } = {};
  try {
    body = (await response.json()) as { error?: string };
  } catch {
    // Some upstream failures have no JSON body. Keep the message user-safe.
  }

  if (!response.ok) {
    throw new Error(body.error ?? fallbackError);
  }
}

function Success({ brand = false }: { brand?: boolean }) {
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    successRef.current?.focus();
  }, []);

  return (
    <div
      aria-live="polite"
      className="form-success"
      ref={successRef}
      role="status"
      tabIndex={-1}
    >
      <div className="success-mark" aria-hidden="true">
        ✓
      </div>
      <h2>
        {brand
          ? "Partnership request received."
          : "You’re on the regional update list."}
      </h2>
      <p>
        {brand
          ? "We review inquiries weekly and aim to follow up at your work email within five business days. Campaign timing still depends on fit and approval."
          : "This does not register you for the September beta. We’ll email as regional availability changes."}
      </p>
      {!brand ? (
        <AppLink
          analyticsEvent="member_app_click"
          className="button button-secondary"
          href={siteLinks.memberApp}
        >
          ELIGIBLE FOR SEPTEMBER? REGISTER IN THE APP
        </AppLink>
      ) : null}
    </div>
  );
}

function PrivacyNotice({ context }: { context: "brand" | "updates" }) {
  return (
    <p className="form-privacy">
      {context === "updates"
        ? "We use these details for regional availability emails. You can unsubscribe from any update. "
        : "We use these details to review and respond to this inquiry. Any campaign requires separate written approval. "}
      Review the GoGymGo <AppLink href={siteLinks.privacy}>Privacy Policy</AppLink>
      {context === "brand" ? (
        <>
          {" "}and <AppLink href={siteLinks.terms}>Terms of Service</AppLink>
        </>
      ) : null}
      .
    </p>
  );
}

export function GymGoerForm() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state === "error") {
      errorRef.current?.focus();
    }
  }, [state]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");
    try {
      await submitRegionalUpdates(
        event.currentTarget,
        "We couldn’t save your information. Please try again.",
      );
      setState("success");
    } catch (cause) {
      setError(
        readErrorMessage(
          cause,
          "We couldn’t save your information. Please try again.",
        ),
      );
      setState("error");
    }
  }

  if (state === "success") {
    return <Success />;
  }

  return (
    <form
      aria-busy={state === "submitting"}
      aria-describedby="gym-form-note"
      className="interest-form"
      data-analytics-form="gym_form_start"
      onSubmit={onSubmit}
    >
      <div className="field-grid">
        <div className="field">
          <label htmlFor="email">EMAIL *</label>
          <input
            autoComplete="email"
            id="email"
            maxLength={254}
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </div>
        <div className="field">
          <label htmlFor="city">CITY / REGION *</label>
          <input
            autoComplete="address-level2"
            id="city"
            maxLength={100}
            name="region"
            placeholder="e.g. Victoria, BC"
            required
          />
        </div>
      </div>

      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="contactFax">Leave this field empty</label>
        <input
          autoComplete="off"
          id="contactFax"
          name="contactFax"
          tabIndex={-1}
        />
      </div>

      <div className="consent-group">
        <input id="gymConsent" name="consent" required type="checkbox" />
        <label htmlFor="gymConsent">
          I agree that GoGymGo may store this information and email me about
          regional availability and launch updates. *
        </label>
      </div>
      <PrivacyNotice context="updates" />

      {state === "error" ? (
        <p className="form-status" ref={errorRef} role="alert" tabIndex={-1}>
          {error}
        </p>
      ) : null}

      <button
        className="submit-button"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "SAVING…" : "GET REGIONAL UPDATES →"}
      </button>
      <p className="fine-print" id="gym-form-note">
        This free update list does not create an app account or competition
        entry, and it does not guarantee launch availability in your region.
      </p>
    </form>
  );
}

export function BrandForm({ defaultInterest = "" }: { defaultInterest?: string }) {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state === "error") {
      errorRef.current?.focus();
    }
  }, [state]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");
    try {
      await submitInterest(
        event.currentTarget,
        "We couldn’t save your partnership request. Please try again.",
      );
      setState("success");
    } catch (cause) {
      setError(
        readErrorMessage(
          cause,
          "We couldn’t save your partnership request. Please try again.",
        ),
      );
      setState("error");
    }
  }

  if (state === "success") {
    return <Success brand />;
  }

  return (
    <form
      aria-busy={state === "submitting"}
      aria-describedby="brand-form-note"
      className="interest-form"
      data-analytics-form="brand_form_start"
      onSubmit={onSubmit}
    >
      <fieldset className="form-section">
        <legend>
          <span>01</span> CONTACT &amp; COMPANY
        </legend>
        <div className="field-grid">
        <div className="field">
          <label htmlFor="brandFullName">YOUR NAME *</label>
          <input
            autoComplete="name"
            id="brandFullName"
            maxLength={100}
            name="fullName"
            placeholder="Your name"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="companyName">GYM OR COMPANY *</label>
          <input
            autoComplete="organization"
            id="companyName"
            maxLength={140}
            name="companyName"
            placeholder="Gym or company name"
            required
          />
        </div>
        </div>

        <div className="field-grid">
          <div className="field">
            <label htmlFor="brandEmail">WORK EMAIL *</label>
            <input
              autoComplete="email"
              id="brandEmail"
              maxLength={254}
              name="email"
              placeholder="name@company.com"
              required
              type="email"
            />
          </div>
          <div className="field">
            <label htmlFor="website">WEBSITE (OPTIONAL)</label>
            <input
              autoComplete="url"
              id="website"
              maxLength={300}
              name="website"
              placeholder="https://"
              type="url"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <span>02</span> CAMPAIGN FIT
        </legend>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="brandRegion">TARGET REGION(S) *</label>
            <input
              id="brandRegion"
              maxLength={160}
              name="region"
              placeholder="e.g. British Columbia"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="partnershipInterest">PARTNERSHIP INTEREST *</label>
            <select
              defaultValue={defaultInterest}
              id="partnershipInterest"
              name="partnershipInterest"
              required
            >
              <option disabled value="">
                Select one
              </option>
              <option value="regional-sponsor">Regional campaign sponsor</option>
              <option value="brand-rewards">Product or coupon inventory</option>
              <option value="creator-campaign">Creator workout campaign</option>
              <option value="gym-partnership">Partner gym network</option>
              <option value="explore">Explore the right fit</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="message">CAMPAIGN DETAILS (OPTIONAL)</label>
          <textarea
            id="message"
            maxLength={1200}
            name="message"
            placeholder="Share your preferred timing, audience, region, inventory, budget range, fulfillment plan, or reporting needs."
          />
        </div>
      </fieldset>

      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="brandContactFax">Leave this field empty</label>
        <input
          autoComplete="off"
          id="brandContactFax"
          name="contactFax"
          tabIndex={-1}
        />
      </div>

      <fieldset className="form-section form-section--consent">
        <legend>
          <span>03</span> CONSENT &amp; NEXT STEP
        </legend>
        <div className="consent-group">
          <input id="brandConsent" name="consent" required type="checkbox" />
          <label htmlFor="brandConsent">
            I agree that GoGymGo may store this information and contact me about
            partnership opportunities. *
          </label>
        </div>
        <PrivacyNotice context="brand" />
      </fieldset>

      {state === "error" ? (
        <p className="form-status" ref={errorRef} role="alert" tabIndex={-1}>
          {error}
        </p>
      ) : null}

      <button
        className="submit-button"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting"
          ? "SENDING…"
          : "REQUEST A PARTNERSHIP REVIEW →"}
      </button>
      <p className="fine-print" id="brand-form-note">
        Submitting this form does not create a campaign or agreement. Placements,
        rewards, creative, reporting, claims, and regional terms require review
        and written approval.
      </p>
    </form>
  );
}
