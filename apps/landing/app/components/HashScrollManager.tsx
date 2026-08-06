"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function HashScrollManager() {
  const pathname = usePathname();

  useEffect(() => {
    const pendingTimeouts = new Set<number>();

    const queueHashScroll = () => {
      [50, 250, 700, 1200].forEach((delay) => {
        const timeoutId = window.setTimeout(() => {
          pendingTimeouts.delete(timeoutId);
          const targetId = decodeURIComponent(window.location.hash.slice(1));
          document.getElementById(targetId)?.scrollIntoView({ block: "start" });
        }, delay);
        pendingTimeouts.add(timeoutId);
      });
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && destination.hash) {
        queueHashScroll();
      }
    };

    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("hashchange", queueHashScroll);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("hashchange", queueHashScroll);
      pendingTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    if (!window.location.hash) {
      return;
    }

    let cancelled = false;
    const scrollToHash = () => {
      if (cancelled) {
        return;
      }

      const targetId = decodeURIComponent(window.location.hash.slice(1));
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    };

    const frameId = window.requestAnimationFrame(scrollToHash);
    const timeoutIds = [120, 350, 700, 1200].map((delay) =>
      window.setTimeout(scrollToHash, delay),
    );
    const resizeObserver = new ResizeObserver(scrollToHash);
    resizeObserver.observe(document.body);
    const observerTimeoutId = window.setTimeout(
      () => resizeObserver.disconnect(),
      1400,
    );
    document.fonts?.ready.then(scrollToHash);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.clearTimeout(observerTimeoutId);
      resizeObserver.disconnect();
    };
  }, [pathname]);

  return null;
}
