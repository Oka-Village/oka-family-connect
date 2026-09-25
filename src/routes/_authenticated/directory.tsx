import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/oka/empty-state";

export const Route = createFileRoute("/_authenticated/directory")({
  head: () => ({
    meta: [
      { title: "Directory — Oka" },
      { name: "description", content: "Meet the people of the Oka family." },
      { property: "og:title", content: "Directory — Oka" },
      { property: "og:description", content: "Meet the people of the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <EmptyState
      icon={Users}
      label="Directory"
      title="Faces of the family, arriving soon"
      description="A gentle way to find the people you haven't met yet — by place, by gift, by what they're drawn to."
    />
  ),
});
