import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#080b0e",
    description:
      "Verified partner-gym workouts, Weekly Goals, regional competition, social challenges, and published rewards.",
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
