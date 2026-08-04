"use client";

import { useEffect } from "react";
import {
  type PublicSiteEventName,
  publicSiteEventNames,
  recordPublicSiteEvent,
} from "../public-site-events";

const allowedEvents = new Set<string>(publicSiteEventNames);

export function PublicSiteAnalytics() {
  useEffect(() => {
    const startedForms = new WeakSet<HTMLFormElement>();

    function record(value: string | undefined) {
      if (value && allowedEvents.has(value)) {
        recordPublicSiteEvent(value as PublicSiteEventName);
      }
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest<HTMLElement>("[data-analytics-event]");
      record(link?.dataset.analyticsEvent);
    }

    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const form = target.closest<HTMLFormElement>("form[data-analytics-form]");
      if (!form || startedForms.has(form)) {
        return;
      }

      startedForms.add(form);
      record(form.dataset.analyticsForm);
    }

    function onToggle(event: Event) {
      const target = event.target;
      if (target instanceof HTMLDetailsElement && target.open) {
        recordPublicSiteEvent("faq_open");
      }
    }

    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("toggle", onToggle, true);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);

  return null;
}
