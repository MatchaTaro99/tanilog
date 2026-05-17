import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaniLog PWA",
    short_name: "TaniLog",
    description: "Logbook harian dan kalkulator finansial pertanian offline-ready",
    start_url: "/",
    display: "standalone",
    background_color: "#064e3b",
    theme_color: "#059669",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
