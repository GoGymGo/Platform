"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type FeedbackState = "idle" | "submitting" | "success" | "error";

export function PublicSiteFeedbackForm() {
  const [state, setState] = useState<FeedbackState>("idle");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === "error") {
      errorRef.current?.focus();
    }
    if (state === "success") {
      successRef.current?.focus();
    }
  }, [state]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setState("submitting");
    setError("");

    try {
      const response = await fetch("/api/public-site-feedback", {
        body: JSON.stringify({
          category: formData.get("category"),
          consent: formData.get("consent") === "on",
          contactFax: formData.get("contactFax"),
          email: formData.get("email"),
          message: formData.get("message"),
          page: formData.get("page"),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      let body: { error?: string } = {};
      try {
        body = (await response.json()) as { error?: string };
      } catch {
        // Keep the fallback message when an upstream response has no JSON body.
      }

      if (!response.ok) {
        throw new Error(body.error ?? "We couldn't save your report. Please try again.");
      }

      setState("success");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't save your report. Please try again.",
      );
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div
        aria-live="polite"
        className="feedback-success"
        ref={successRef}
        role="status"
        tabIndex={-1}
      >
        <span aria-hidden="true">✓</span>
        <div>
          <h3>Public-site report received.</h3>
          <p>
            Thank you for the detail. We will use the email you provided if a
            follow-up is needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      aria-busy={state === "submitting"}
      aria-describedby="public-site-feedback-note"
      className="interest-form feedback-form"
      onSubmit={onSubmit}
    >
      <div className="field-grid">
        <div className="field">
          <label htmlFor="feedbackCategory">TYPE OF PROBLEM *</label>
          <select
            defaultValue=""
            id="feedbackCategory"
            name="category"
            required
          >
            <option disabled value="">
              Select one
            </option>
            <option value="accessibility">Accessibility barrier</option>
            <option value="broken_link">Broken or incorrect link</option>
            <option value="form_problem">Public form problem</option>
            <option value="readability">Readability or layout</option>
            <option value="other">Something else</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="feedbackEmail">YOUR EMAIL *</label>
          <input
            autoComplete="email"
            id="feedbackEmail"
            maxLength={320}
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="feedbackPage">PAGE OR LINK WITH THE PROBLEM *</label>
        <input
          id="feedbackPage"
          maxLength={300}
          name="page"
          placeholder="e.g. FAQ, Regional updates, or a page URL"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="feedbackMessage">WHAT HAPPENED? *</label>
        <textarea
          id="feedbackMessage"
          maxLength={2000}
          minLength={20}
          name="message"
          placeholder="Describe what you expected, what happened, and any device or browser detail that may help."
          required
        />
      </div>

      <div aria-hidden="true" className="visually-hidden">
        <label htmlFor="feedbackContactFax">Leave this field empty</label>
        <input
          autoComplete="off"
          id="feedbackContactFax"
          name="contactFax"
          tabIndex={-1}
        />
      </div>

      <div className="consent-group">
        <input id="feedbackConsent" name="consent" required type="checkbox" />
        <label htmlFor="feedbackConsent">
          I agree that GoGymGo may store this report and contact me about it. *
        </label>
      </div>

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
        {state === "submitting" ? "SENDING…" : "SEND PUBLIC-SITE REPORT →"}
      </button>
      <p className="fine-print" id="public-site-feedback-note">
        Do not include passwords, authentication codes, health information, or
        precise workout-location evidence. This form is for the public website,
        not competition or account support.
      </p>
    </form>
  );
}
