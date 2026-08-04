"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { primaryNavigationItems } from "../site-links";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
      toggleRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div className="mobile-navigation">
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
      <dialog
        aria-labelledby="mobile-navigation-label"
        className="mobile-navigation__panel"
        id="mobile-navigation-panel"
        onCancel={(event) => {
          event.preventDefault();
          setIsOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsOpen(false);
          }
        }}
        ref={dialogRef}
      >
        <nav aria-label="Mobile navigation">
          <span className="mobile-navigation__label" id="mobile-navigation-label">
            NAVIGATION // OPEN
          </span>
          {primaryNavigationItems.map((item, index) => {
            const content = (
              <>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
              <b aria-hidden="true">→</b>
              </>
            );
            const ariaCurrent =
              "currentPath" in item && pathname === item.currentPath
                ? "page"
                : undefined;

            return item.href.startsWith("/#") ? (
              <a
                aria-current={ariaCurrent}
                href={item.href}
                key={item.href}
                onClick={() => setIsOpen(false)}
              >
                {content}
              </a>
            ) : (
              <Link
                aria-current={ariaCurrent}
                href={item.href}
                key={item.href}
                onClick={() => setIsOpen(false)}
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </dialog>
    </div>
  );
}
