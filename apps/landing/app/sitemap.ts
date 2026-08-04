import type { MetadataRoute } from "next";

const routes = ["", "/gym-goers", "/brands", "/faq", "/contact", "/accessibility"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-03T00:00:00-07:00");

  return routes.map((route) => ({
    changeFrequency: route ? "monthly" : "weekly",
    lastModified,
    priority: route ? 0.7 : 1,
    url: `https://gogymgo.com${route}`,
  }));
}
