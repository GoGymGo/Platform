import type { MetadataRoute } from "next";
import { getSeptemberCampaignState, septemberCampaign } from "./campaign";

export default function manifest(): MetadataRoute.Manifest {
  const campaignState = getSeptemberCampaignState();

  return {
    background_color: "#080b0e",
    description:
      campaignState.phase === "ended"
        ? `September 2026 beta details and future regional updates for ${septemberCampaign.regionName}.`
        : `Free September 2026 beta for eligible gym-goers age ${septemberCampaign.minimumAge}+ on ${septemberCampaign.regionName}.`,
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
