export const siteLinks = {
  accessibility: "/accessibility",
  brands: "/brands",
  contact: "/contact",
  demo: "https://app.gogymgo.com/demo",
  faq: "/faq",
  gymGoers: "/gym-goers",
  home: "/",
  memberApp: "https://app.gogymgo.com/",
  officialRules: "https://app.gogymgo.com/official-rules",
  privacy: "https://app.gogymgo.com/privacy-policy",
  terms: "https://app.gogymgo.com/terms-of-service",
} as const;

export const primaryNavigationItems = [
  {
    currentPath: "/",
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
  {
    href: siteLinks.demo,
    label: "DEMO",
  },
] as const;
