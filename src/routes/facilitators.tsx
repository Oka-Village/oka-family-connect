import { createFileRoute } from "@tanstack/react-router";

import { FacilitatorsPage } from "@/components/oka/facilitators";

export const Route = createFileRoute("/facilitators")({
  head: () => ({ meta: [
    { title: "Join as a facilitator — Oka" },
    { name: "description", content: "Share your gift with One World Family: offer professional online sessions to a warm global community." },
    { property: "og:title", content: "Join as a facilitator — Oka" },
    { property: "og:description", content: "Share your gift with One World Family: offer professional online sessions to a warm global community." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FacilitatorsPage,
});
