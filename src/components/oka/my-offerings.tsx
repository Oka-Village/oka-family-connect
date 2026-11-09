import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { DeleteListingButton } from "@/components/oka/delete-listing-button";

import { SkillCard } from "@/components/oka/skill-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { SKILL_SELECT, signPaths, type SkillRow } from "@/lib/skills";

/** "My Offerings" on My Profile: every skill I've listed, including archived ones. */
export function MyOfferings({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["my-skills", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("skills").select(SKILL_SELECT).eq("owner_id", userId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as SkillRow[];
      const sign = await signPaths(rows.flatMap((s) => [s.photo_url, s.owner?.photo_url]));
      return rows.map((s) => ({ ...s, photo: sign(s.photo_url), hostPhoto: sign(s.owner?.photo_url) }));
    },
  });

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label">My offerings</p>
          <h2 className="mt-2 text-3xl text-foreground">What I share</h2>
        </div>
        <Button asChild className="rounded-full"><Link to="/skills/new"><Plus className="size-4" strokeWidth={1.5} />Offer a skill</Link></Button>
      </div>
      {q.data?.length ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {q.data.map((s) => (
            <div key={s.id} className="relative">
              {s.status !== "published" && <span className="absolute right-3 top-3 z-10 rounded-full bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground shadow-soft">Archived</span>}
              <SkillCard skill={s} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/skills/edit/$skillId" params={{ skillId: s.id }}><Pencil className="size-4 text-primary" strokeWidth={1.5} />Edit</Link></Button>
                <DeleteListingButton kind="skills" id={s.id} title={s.title} ownerId={s.owner_id} userId={userId} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="surface-card mt-6 p-6 text-muted-foreground">{q.isLoading ? "…" : "You haven't offered a skill yet. One hour of what you love is one credit for the family."}</p>
      )}
    </section>
  );
}
