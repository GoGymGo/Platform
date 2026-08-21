"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type FeedbackState = "idle" | "submitting" | "success" | "error";

export function PublicSiteFeedbackForm() {
  const [state, setState] = useState<FeedbackState>("idle");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const submissionIdRef = useRef<string | null>(null);

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
    submissionIdRef.current ??= crypto.randomUUID();
    setState("submitting");
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch("/api/public-site-feedback", {
        body: JSON.stringify({
          category: formData.get("category"),
          consent: formData.get("consent") === "on",
          contactFax: formData.get("contactFax"),
          email: formData.get("email"),
          message: formData.get("message"),
          page: formData.get("page"),
          submissionId: submissionIdRef.current,
        }),
        credentials: "omit",
        headers: { "content-type": "application/json" },
        method: "POST",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          await readPublicError(
            response,
            "We couldn't save your report. Please try again.",
          ),
        );
      }

      setState("success");
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "AbortError"
          ? "The request took too long. Check your connection and try again."
          : cause instanceof Error
          ? cause.message
          : "We couldn't save your report. Please try again.",
      );
      setState("error");
    } finally {
      window.clearTimeout(timeout);
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
            Thank you for the detail. If you provided an email, we will use it
            only if a follow-up about this report is needed.
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
      data-analytics-form="feedback_form_start"
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
          <label htmlFor="feedbackEmail">YOUR EMAIL (OPTIONAL)</label>
          <input
            autoComplete="email"
            aria-describedby="public-site-feedback-contact-note"
            id="feedbackEmail"
            maxLength={320}
            name="email"
            placeholder="you@example.com"
            type="email"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="feedbackPage">PUBLIC PAGE WITH THE PROBLEM *</label>
        <select
          defaultValue=""
          id="feedbackPage"
          name="page"
          required
        >
          <option disabled value="">
            Select one
          </option>
          <option value="home">Home</option>
          <option value="gym_goers">Gym goers</option>
          <option value="partners">Partners</option>
          <option value="brands">Brands</option>
          <option value="faq">FAQ</option>
          <option value="contact">Contact</option>
          <option value="accessibility">Accessibility</option>
          <option value="account_deletion">Account deletion</option>
          <option value="other">Another public page</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="feedbackMessage">WHAT HAPPENED? *</label>
        <textarea
          id="feedbackMessage"
          maxLength={2000}
          minLength={20}
          name="message"
          placeholder="Describe what you expected and what happened."
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
        <input id="feedbackConsent" name="consent" type="checkbox" />
        <label htmlFor="feedbackConsent">
          If I provide an email, I agree that GoGymGo may use it to contact me
          about this report.
        </label>
      </div>
      <p className="fine-print" id="public-site-feedback-contact-note">
        You can report a problem without giving an email. Reports are deleted
        after the approved retention period and never kept longer than 180 days.
      </p>

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
          : state === "error"
            ? "TRY AGAIN →"
            : "SEND PUBLIC-SITE REPORT →"}
      </button>
      <p className="fine-print" id="public-site-feedback-note">
        Do not include passwords, authentication codes, health information, or
        precise workout-location evidence. This form is for the public website,
        not contest or account support.
      </p>
    </form>
  );
}

async function readPublicError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      "error" in value &&
      typeof value.error === "string" &&
      value.error.length > 0 &&
      value.error.length <= 240
    ) {
      return value.error;
    }
  } catch {
    // Keep the privacy-safe fallback when the response is not the exact schema.
  }
  return fallback;
}
