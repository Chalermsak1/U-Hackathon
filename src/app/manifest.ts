import type { MetadataRoute } from "next";

// Web app manifest: lets phones and desktops install U-Guard as an app (home-screen icon, opens
// full screen without browser bars, straight into the terminal). Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/terminal",
    name: "U-Guard · Know before your money moves",
    short_name: "U-Guard",
    description: "An agent in U-Bot that checks token-unlock risk before you buy or hold, explains it in three plain lines with voice, and waits for your approval.",
    start_url: "/terminal",
    scope: "/",
    display: "standalone",
    background_color: "#070b14",
    theme_color: "#070b14",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ask U-Bot", url: "/terminal/agent", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My portfolio", url: "/terminal/portfolio", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Alerts", url: "/terminal/alerts", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
