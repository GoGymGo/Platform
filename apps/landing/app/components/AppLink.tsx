import type { ComponentProps } from "react";
import Link from "next/link";

type AppLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  analyticsEvent?: string;
  destinationLabel?: string;
  href: string;
};

export function AppLink({
  analyticsEvent,
  children,
  destinationLabel = "opens the GoGymGo app",
  href,
  ...props
}: AppLinkProps) {
  return (
    <Link
      {...props}
      data-analytics-event={analyticsEvent}
      href={href}
    >
      {children}
      <span aria-hidden="true" className="app-link-cue">
        ↗
      </span>
      <span className="visually-hidden"> ({destinationLabel})</span>
    </Link>
  );
}
