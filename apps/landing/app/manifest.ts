import type { MetadataRoute } from "next";
import { septemberCampaign } from "./campaign";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#080b0e",
    description:
      `Free September 2026 beta for eligible gym-goers age ${septemberCampaign.minimumAge}+ on ${septemberCampaign.regionName}.`,
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/mark.svg",
        type: "image/svg+xml",
      },
    ],
    name: "GoGymGo",
    short_name: "GoGymGo",
    start_url: "/",
    theme_color: "#080b0e",
  };
}
