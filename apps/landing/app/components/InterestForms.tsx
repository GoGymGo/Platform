"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

function readErrorMessage(error: unknown) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "We couldn't save your information. Please try again.";
}

async function submitInterest(
  form: HTMLFormElement,
  audience: "gym_goer" | "brand",
) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const response = await fetch("/api/interest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...payload,
      audience,
      consent: formData.get("consent") === "on",
    }),
  });

  const body = (await response.json()) as { error?: unknown };
  if (!response.ok) {
    throw new Error(readErrorMessage(body.error));
  }
}

function Success({
  brand = false,
}: {
  brand?: boolean;
}) {
  return (
    <div className="form-success" role="status">
      <div className="success-mark" aria-hidden="true">
        ✓
      </div>
      <h2>{brand ? "Application received." : "You’re on the list."}</h2>
      <p>
        {brand
          ? "Thanks for your interest in GoGymGo. We’ll follow up at your work email as founding partnership opportunities open."
          : "We’ll email you with launch news and let you know when pre-registration opens in your region."}
      </p>
    </div>
  );
}

export function GymGoerForm() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");
    try {
      await submitInterest(event.currentTarget, "gym_goer");
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
    <form className="interest-form" onSubmit={onSubmit}>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="fullName">FULL NAME *</label>
          <input
            autoComplete="name"
            id="fullName"
            maxLength={100}
            name="fullName"
            placeholder="Your name"
            required
          />
        </div>
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
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="city">CITY / REGION *</label>
          <input
            autoComplete="address-level2"
            id="city"
            maxLength={100}
            name="region"
            placeholder="e.g. Vancouver, BC"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="workoutStyle">HOW DO YOU TRAIN? *</label>
          <select defaultValue="" id="workoutStyle" name="workoutStyle" required>
            <option disabled value="">
              Select one
            </option>
            <option value="strength">Strength training</option>
            <option value="cardio">Cardio / endurance</option>
            <option value="classes">Fitness classes</option>
            <option value="mixed">A mix of everything</option>
            <option value="starting">I’m getting started</option>
          </select>
        </div>
      </div>

      <fieldset className="field">
        <legend className="fieldset-label">
          YOUR IDEAL WEEKLY GOAL *
        </legend>
        <div className="radio-grid">
          {[2, 3, 4, 5].map((days) => (
            <div className="radio-card" key={days}>
              <input
                defaultChecked={days === 3}
                id={`goal-${days}`}
                name="goalDays"
                required
                type="radio"
                value={days}
              />
              <label htmlFor={`goal-${days}`}>{days} DAYS</label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="discoverySource">HOW DID YOU HEAR ABOUT US?</label>
        <select defaultValue="" id="discoverySource" name="discoverySource">
          <option value="">Select one</option>
          <option value="friend">Friend or family</option>
          <option value="social">Social media</option>
          <option value="gym">My gym</option>
          <option value="creator">Fitness creator</option>
          <option value="search">Search</option>
          <option value="other">Other</option>
        </select>
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

      <label className="consent-row">
        <input name="consent" required type="checkbox" />
        <span>
          I agree that GoGymGo may store this information and email me about
          pre-registration, regional availability, and launch updates. *
        </span>
      </label>

      {state === "error" ? (
        <p className="form-status" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="submit-button"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "SAVING…" : "JOIN THE PRE-REGISTRATION LIST →"}
      </button>
      <p className="fine-print">
        Pre-registration is free and does not create a competition entry or
        guarantee launch availability in your region.
      </p>
    </form>
  );
}

export function BrandForm() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setError("");
    try {
      await submitInterest(event.currentTarget, "brand");
      setState("success");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t save your application. Please try again.",
      );
      setState("error");
    }
  }

  if (state === "success") {
    return <Success brand />;
  }

  return (
    <form className="interest-form" onSubmit={onSubmit}>
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
          <label htmlFor="website">WEBSITE</label>
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
            placeholder="e.g. Canada, Pacific Northwest"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="interest">PARTNERSHIP INTEREST *</label>
          <select defaultValue="" id="interest" name="interest" required>
            <option disabled value="">
              Select one
            </option>
            <option value="regional-sponsor">Regional campaign sponsor</option>
            <option value="brand-rewards">Brand Reward supplier</option>
            <option value="creator-campaign">Creator workout campaign</option>
            <option value="gym-partnership">Partner gym network</option>
            <option value="explore">Let’s explore</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="message">TELL US WHAT YOU HAVE IN MIND</label>
        <textarea
          id="message"
          maxLength={1200}
          name="message"
          placeholder="Your goals, timing, target audience, reward ideas, or anything else that would help us understand the fit."
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

      <label className="consent-row">
        <input name="consent" required type="checkbox" />
        <span>
          I agree that GoGymGo may store this information and contact me about
          partnership opportunities. *
        </span>
      </label>

      {state === "error" ? (
        <p className="form-status" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="submit-button"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "SENDING…" : "APPLY AS A FOUNDING PARTNER →"}
      </button>
      <p className="fine-print">
        Submitting this form does not create a campaign or partnership
        agreement. All placements, rewards, claims, and regional terms require
        approval.
      </p>
    </form>
  );
}
