import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/oka/empty-state";

export const Route = createFileRoute("/_authenticated/skills")({
  head: () => ({
    meta: [
      { title: "Skills — Oka" },
      { name: "description", content: "Offer and receive gifts of skill in the credit economy." },
      { property: "og:title", content: "Skills — Oka" },
      {
        property: "og:description",
        content: "Offer and receive gifts of skill in the credit economy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <EmptyState
      icon={Sparkles}
      label="Skills"
      title="Gifts to give and receive"
      description="One hour of a shared skill is one credit. Offering and booking opens in the next phase."
    />
  ),
});
