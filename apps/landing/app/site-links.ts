const configuredMemberAppOrigin =
  process.env.NEXT_PUBLIC_MEMBER_APP_ORIGIN?.trim();
const memberAppOrigin = (
  configuredMemberAppOrigin || "https://app.gogymgo.com"
).replace(/\/+$/, "");

export const siteLinks = {
  accessibility: "/accessibility",
  brandPartnerApplication: "/partners?interest=brand#partner-form",
  brands: "/brands",
  contact: "/contact",
  demo: `${memberAppOrigin}/demo`,
  faq: "/faq",
  gymPartnerApplication: "/partners?interest=gym#partner-form",
  gymGoers: "/gym-goers",
  home: "/",
  memberApp: `${memberAppOrigin}/join`,
  officialRules: `${memberAppOrigin}/official-rules`,
  partnerApplication: "/partners#partner-form",
  partners: "/partners",
  privacy: `${memberAppOrigin}/privacy-policy`,
  publicSiteHelp: "/contact#public-site-help",
  regionalUpdates: "/gym-goers#gym-form",
  terms: `${memberAppOrigin}/terms-of-service`,
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
    currentPath: "/brands",
    href: siteLinks.brands,
    label: "FITNESS BRANDS",
  },
  {
    currentPath: "/faq",
    href: siteLinks.faq,
    label: "FAQ",
  },
] as const;
