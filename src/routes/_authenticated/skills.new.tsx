import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";

import { SkillForm } from "@/components/oka/skill-form";
import { useCurrentUserId } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/skills/new")({
  head: () => ({
    meta: [
      { title: "Offer a skill — Oka" },
      { name: "description", content: "Share something you love with the Oka family." },
      { property: "og:title", content: "Offer a skill — Oka" },
      { property: "og:description", content: "Share something you love with the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewSkill,
});

function NewSkill() {
  const { data: uid } = useCurrentUserId();
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <Link to="/skills" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> Skills
      </Link>
      <p className="section-label mt-8">My offerings</p>
      <h1 className="mt-3 text-4xl text-foreground">Offer a skill</h1>
      <div className="mt-8">{uid ? <SkillForm userId={uid} /> : <Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} />}</div>
    </div>
  );
}
