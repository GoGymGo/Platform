"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const navigationItems = [
  { href: "/#how-it-works", label: "HOW IT WORKS" },
  { href: "https://app.gogymgo.com/demo", label: "DEMO" },
  { href: "/gym-goers", label: "GYM GOERS" },
  { href: "/brands", label: "FITNESS BRANDS" },
] as const;

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement>(null);

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
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
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
          {navigationItems.map((item, index) => (
            <Link
              href={item.href}
              key={item.href}
              onClick={() => setIsOpen(false)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
              <b aria-hidden="true">↗</b>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
