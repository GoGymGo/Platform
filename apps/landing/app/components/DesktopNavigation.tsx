"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNavigationItems } from "../site-links";

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="desktop-navigation">
      {primaryNavigationItems.map((item) => {
        const ariaCurrent =
          "currentPath" in item && pathname === item.currentPath
            ? "page"
            : undefined;

        return item.href.startsWith("/#") ? (
          <a aria-current={ariaCurrent} href={item.href} key={item.href}>
            {item.label}
          </a>
        ) : (
          <Link
            aria-current={ariaCurrent}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
