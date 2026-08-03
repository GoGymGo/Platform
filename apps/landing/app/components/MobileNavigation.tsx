"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { primaryNavigationItems } from "../site-links";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const navigationRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!navigationRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        toggleRef.current?.focus();
        return;
      }

      if (event.key === "Tab") {
        const focusable = navigationRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href]',
        );
        if (!focusable?.length) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="mobile-navigation" ref={navigationRef}>
      <button
        aria-controls="mobile-navigation-panel"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        className="mobile-navigation__toggle"
        onClick={() => setIsOpen((current) => !current)}
        ref={toggleRef}
        type="button"
      >
        <span aria-hidden="true" className="mobile-navigation__icon" />
      </button>
      {isOpen ? (
        <nav
          aria-label="Mobile navigation"
          className="mobile-navigation__panel"
          id="mobile-navigation-panel"
        >
          <span className="mobile-navigation__label">NAVIGATION // OPEN</span>
          {primaryNavigationItems.map((item, index) => (
            <Link
              aria-current={
                "currentPath" in item && pathname === item.currentPath
                  ? "page"
                  : undefined
              }
              href={item.href}
              key={item.href}
              onClick={() => setIsOpen(false)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
