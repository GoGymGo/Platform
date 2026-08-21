import type { ReactNode } from "react";

type AppLinkProps = {
  analyticsEvent?: string;
  children: ReactNode;
  className?: string;
  destinationLabel?: string;
  href: string | null;
  unavailableLabel?: string;
};

export function AppLink({
  analyticsEvent,
  children,
  className,
  destinationLabel = "opens the GoGymGo app",
  href,
  unavailableLabel = "Member app link unavailable",
}: AppLinkProps) {
  if (!href) {
    return (
      <span
        aria-label={`${unavailableLabel}. The canonical member-app origin is not configured.`}
        className={[className, "app-link--unavailable"].filter(Boolean).join(" ")}
        data-destination-unavailable="member-app"
      >
        {unavailableLabel}
      </span>
    );
  }

  return (
    <a
      className={className}
      data-analytics-event={analyticsEvent}
      href={href}
      rel="external noopener noreferrer"
    >
      {children}
      <span aria-hidden="true" className="app-link-cue">
        ↗
      </span>
      <span className="visually-hidden"> ({destinationLabel})</span>
    </a>
  );
}
