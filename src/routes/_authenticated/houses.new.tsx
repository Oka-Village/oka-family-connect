import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { HouseForm } from "@/components/oka/house-form";
import { useCurrentUserId } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/houses/new")({
  head: () => ({
    meta: [
      { title: "List my home — Oka" },
      { name: "description", content: "Open your home to the Oka family." },
      { property: "og:title", content: "List my home — Oka" },
      { property: "og:description", content: "Open your home to the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewHouse,
});

function NewHouse() {
  const { data: uid } = useCurrentUserId();
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <Link to="/houses" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> Houses</Link>
      <p className="section-label mt-8">My offerings</p>
      <h1 className="mt-3 text-4xl text-foreground">Open your home</h1>
      <div className="mt-8">{uid ? <HouseForm userId={uid} /> : <Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} />}</div>
    </div>
  );
}
