export const publicSiteOrigin = "https://gogymgo.com";

const approvedMemberAppOrigins = new Set(["https://app.gogymgo.com"]);

export function normalizeMemberAppOrigin(
  value: string | undefined,
): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const hasUnexpectedParts =
      Boolean(url.username || url.password || url.search || url.hash) ||
      url.pathname !== "/";
    if (hasUnexpectedParts) {
      return null;
    }

    const origin = url.origin;
    if (approvedMemberAppOrigins.has(origin)) {
      return origin;
    }
  } catch {
    // Invalid or relative destinations are unavailable, not best-effort links.
  }

  return null;
}

export function normalizeLocalMemberAppOrigin(
  value: string | undefined,
): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const isLoopback =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const hasUnexpectedParts =
      Boolean(url.username || url.password || url.search || url.hash) ||
      url.pathname !== "/";
    if (
      isLoopback &&
      !hasUnexpectedParts &&
      (url.protocol === "http:" || url.protocol === "https:")
    ) {
      return url.origin;
    }
  } catch {
    // Invalid or relative destinations are unavailable, not best-effort links.
  }

  return null;
}

const configuredMemberAppOrigin =
  process.env.NEXT_PUBLIC_MEMBER_APP_ORIGIN;
export const memberAppOrigin =
  normalizeMemberAppOrigin(configuredMemberAppOrigin) ??
  (process.env.NODE_ENV !== "production"
    ? normalizeLocalMemberAppOrigin(configuredMemberAppOrigin)
    : null);

function memberAppPath(path: `/${string}`): string | null {
  return memberAppOrigin ? new URL(path, `${memberAppOrigin}/`).toString() : null;
}

export const siteLinks = {
  accountData: memberAppPath("/account-data"),
  accountDeletion: "/account-deletion",
  accessibility: "/accessibility",
  brandPartnerApplication: "/partners?interest=brand#partner-form",
  brands: "/brands",
  contact: "/contact",
  demo: memberAppPath("/demo"),
  faq: "/faq",
  forgotPassword: memberAppPath("/forgot-password"),
  gymPartnerApplication: "/partners?interest=gym#partner-form",
  gymGoers: "/gym-goers",
  home: "/",
  memberApp: memberAppPath("/join"),
  officialRules: memberAppPath("/official-rules"),
  partnerApplication: "/partners#partner-form",
  partners: "/partners",
  privacy: memberAppPath("/privacy-policy"),
  publicSiteHelp: "/contact#public-site-help",
  regionalUpdates: "/gym-goers#gym-form",
  terms: memberAppPath("/terms-of-service"),
} as const;

export const primaryNavigationItems = [
  {
    href: "/#how-it-works",
    label: "HOW IT WORKS",
  },
  {
    currentPath: "/gym-goers",
    href: siteLinks.gymGoers,
    label: "GYM GOERS",
  },
  {
    currentPath: "/partners",
    href: siteLinks.partners,
    label: "PARTNERS",
  },
  {
    currentPath: "/faq",
    href: siteLinks.faq,
    label: "FAQ",
  },
] as const;
