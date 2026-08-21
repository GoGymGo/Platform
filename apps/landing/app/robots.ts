import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "./site-links";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: ["/api/", "/demo"],
      userAgent: "*",
    },
    sitemap: `${publicSiteOrigin}/sitemap.xml`,
  };
}
