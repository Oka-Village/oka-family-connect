import { useQuery } from "@tanstack/react-query";

import { HouseCard } from "@/components/oka/house-card";
import { SkillCard } from "@/components/oka/skill-card";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { HOUSE_SELECT, withSignedHousePhotos, type HouseRow } from "@/lib/houses";
import { SKILL_SELECT, signPaths, type SkillRow } from "@/lib/skills";

type OwnerWithProfile = { id: string; display_name: string | null; photo_url: string | null; profile_completed: boolean };

type Featured = {
  homes: Awaited<ReturnType<typeof withSignedHousePhotos>>;
  skills: Array<SkillRow & { photo?: string | null; hostPhoto?: string | null }>;
};

const EMPTY: Featured = { homes: [], skills: [] };

/** Home: two featured rails — newest skills and homes; a rail hides itself when empty. */
export function HomeFeatured() {
  const { data: profile } = useProfile();
  const q = useQuery({
    queryKey: ["home-featured", profile?.id ?? null],
    enabled: Boolean(profile),
    queryFn: async (): Promise<Featured> => {
      // Newest published homes whose owner has a completed (public) profile.
      const homesRes = supabase
        .from("houses")
        .select(`${HOUSE_SELECT.replace("owner:profiles!houses_owner_id_fkey(id,display_name,photo_url)", "owner:profiles!houses_owner_id_fkey(id,display_name,photo_url,profile_completed)")}`)
        .eq("status", "published")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(12);
      // Newest published skills.
      const skillsRes = supabase
        .from("skills")
        .select(SKILL_SELECT)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(6);

      const [homes, skills] = await Promise.all([homesRes, skillsRes]);
      if (homes.error) throw homes.error;
      if (skills.error) throw skills.error;

      const homeRows = ((homes.data ?? []) as unknown as Array<HouseRow & { owner?: OwnerWithProfile | null }>)
        .filter((h) => h.owner?.profile_completed).slice(0, 3);
      const skillRows = ((skills.data ?? []) as SkillRow[]).slice(0, 3);

      const [signedHomes, signedSkills] = await Promise.all([
        withSignedHousePhotos(homeRows),
        (async () => {
          const sign = await signPaths(skillRows.flatMap((s) => [s.photo_url, s.owner?.photo_url]));
          return skillRows.map((s) => ({ ...s, photo: sign(s.photo_url), hostPhoto: sign(s.owner?.photo_url) }));
        })(),
      ]);
      return {
        homes: signedHomes,
        skills: signedSkills,
      };
    },
  });

  const data = q.data ?? EMPTY;
  if (q.isLoading || q.isError) return null;
  const rails: Array<{ key: string; label: string; items: React.ReactNode[] }> = [];
  if (data.skills.length) rails.push({ key: "skills", label: "Featured skills", items: data.skills.map((s) => <SkillCard key={s.id} skill={s} />) });
  if (data.homes.length) rails.push({ key: "homes", label: "Featured homes", items: data.homes.map((h) => <HouseCard key={h.id} house={h} />) });

  if (!rails.length) return null;

  return (
    <>
      {rails.map((rail) => (
        <section key={rail.key} aria-labelledby={`featured-${rail.key}-heading`} className="flex flex-col gap-5">
          <h2 id={`featured-${rail.key}-heading`} className="section-label">{rail.label}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{rail.items}</div>
        </section>
      ))}
    </>
  );
}
