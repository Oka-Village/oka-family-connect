import { createFileRoute } from "@tanstack/react-router";
import { Coins } from "lucide-react";

import { EmptyState } from "@/components/oka/empty-state";

export const Route = createFileRoute("/_authenticated/credits")({
  head: () => ({
    meta: [
      { title: "Credits — Oka" },
      {
        name: "description",
        content: "Your Oka credits: one credit is one night's stay or one hour of service.",
      },
      { property: "og:title", content: "Credits — Oka" },
      {
        property: "og:description",
        content: "Your Oka credits: one credit is one night's stay or one hour of service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <EmptyState
      icon={Coins}
      label="Credits"
      title="Your credits begin here"
      description="Every night hosted and every hour gifted is recorded, and your balance follows from it. The full ledger arrives with hosting and skill sharing."
    />
  ),
});
