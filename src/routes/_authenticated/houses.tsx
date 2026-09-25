import { createFileRoute } from "@tanstack/react-router";
import { Home } from "lucide-react";

import { EmptyState } from "@/components/oka/empty-state";

export const Route = createFileRoute("/_authenticated/houses")({
  head: () => ({
    meta: [
      { title: "Houses — Oka" },
      { name: "description", content: "Homes open to the family, one credit per night." },
      { property: "og:title", content: "Houses — Oka" },
      { property: "og:description", content: "Homes open to the family, one credit per night." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <EmptyState
      icon={Home}
      label="Houses"
      title="Doors opening soon"
      description="Homes shared with the family — one night is one credit, and no money ever changes hands."
    />
  ),
});
