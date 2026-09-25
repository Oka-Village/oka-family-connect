import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";

import { SkillForm } from "@/components/oka/skill-form";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { SKILL_SELECT, type SkillRow } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/skills/edit/$skillId")({
  head: () => ({
    meta: [
      { title: "Edit offering — Oka" },
      { name: "description", content: "Update your skill offering." },
      { property: "og:title", content: "Edit offering — Oka" },
      { property: "og:description", content: "Update your skill offering." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditSkill,
});

function EditSkill() {
  const { skillId } = Route.useParams();
  const { data: uid } = useCurrentUserId();
  const q = useQuery({
    queryKey: ["skill", skillId, "edit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skills").select(SKILL_SELECT).eq("id", skillId).maybeSingle();
      if (error) throw error;
      return data as unknown as SkillRow | null;
    },
  });
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <Link to="/skills/$skillId" params={{ skillId }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> Back to offering
      </Link>
      <p className="section-label mt-8">My offerings</p>
      <h1 className="mt-3 text-4xl text-foreground">Edit offering</h1>
      <div className="mt-8">
        {q.isLoading || !uid ? (
          <Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} />
        ) : q.data && q.data.owner_id === uid ? (
          <SkillForm userId={uid} initial={q.data} />
        ) : (
          <p className="text-muted-foreground">Only the person offering this skill can edit it.</p>
        )}
      </div>
    </div>
  );
}
