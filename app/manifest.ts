import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vocab Mountain",
    short_name: "Vocab",
    description: "Build a stronger vocabulary, one word at a time.",
    start_url: "/study",
    display: "standalone",
    background_color: "#f0e9ff",
    theme_color: "#f0e9ff",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
