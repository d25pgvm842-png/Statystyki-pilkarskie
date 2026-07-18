import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Staty piłkarskie",
    short_name: "Staty",
    description: "Zbieranie i analiza statystyk piłkarskich",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#059669",
    lang: "pl",
  };
}
