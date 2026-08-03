"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { siteLinks } from "../site-links";

type FormState = "idle" | "submitting" | "success" | "error";

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
        <Link className="button button-secondary" href={siteLinks.memberApp}>
          ELIGIBLE FOR SEPTEMBER? REGISTER IN THE APP →
        </Link>
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
      Review the GoGymGo <Link href={siteLinks.privacy}>Privacy Policy</Link>
      {context === "brand" ? (
        <>
          {" "}and <Link href={siteLinks.terms}>Terms of Service</Link>
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
        cause instanceof Error
          ? cause.message
          : "We couldn’t save your information. Please try again.",
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

export function BrandForm() {
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
        cause instanceof Error
          ? cause.message
          : "We couldn’t save your partnership request. Please try again.",
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
      onSubmit={onSubmit}
    >
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
          <label htmlFor="companyName">COMPANY *</label>
          <input
            autoComplete="organization"
            id="companyName"
            maxLength={140}
            name="companyName"
            placeholder="Company name"
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
            defaultValue=""
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

      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="brandContactFax">Leave this field empty</label>
        <input
          autoComplete="off"
          id="brandContactFax"
          name="contactFax"
          tabIndex={-1}
        />
      </div>

      <div className="consent-group">
        <input id="brandConsent" name="consent" required type="checkbox" />
        <label htmlFor="brandConsent">
          I agree that GoGymGo may store this information and contact me about
          partnership opportunities. *
        </label>
      </div>
      <PrivacyNotice context="brand" />

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
