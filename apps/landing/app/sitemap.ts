import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "./site-links";

const routes = [
  "",
  "/gym-goers",
  "/brands",
  "/partners",
  "/faq",
  "/contact",
  "/accessibility",
  "/account-deletion",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-03T00:00:00-07:00");

  return routes.map((route) => ({
    changeFrequency: route ? "monthly" : "weekly",
    lastModified,
    priority: route ? 0.7 : 1,
    url: `${publicSiteOrigin}${route}`,
  }));
}
