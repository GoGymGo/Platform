export const siteLinks = {
  accessibility: "/accessibility",
  brandPartnerApplication: "/partners?interest=brand#partner-form",
  contact: "/contact",
  demo: "https://app.gogymgo.com/demo",
  faq: "/faq",
  gymPartnerApplication: "/partners?interest=gym#partner-form",
  gymGoers: "/gym-goers",
  home: "/",
  memberApp: "https://app.gogymgo.com/",
  officialRules: "https://app.gogymgo.com/official-rules",
  partnerApplication: "/partners#partner-form",
  partners: "/partners",
  privacy: "https://app.gogymgo.com/privacy-policy",
  publicSiteHelp: "/contact#public-site-help",
  regionalUpdates: "/gym-goers#gym-form",
  terms: "https://app.gogymgo.com/terms-of-service",
} as const;

export const primaryNavigationItems = [
  {
    href: "/#competition-scoring",
    label: "HOW COMPETITION WORKS",
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
