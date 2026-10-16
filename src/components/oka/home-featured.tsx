import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { HouseCard } from "@/components/oka/house-card";
import { SkillCard } from "@/components/oka/skill-card";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { HOUSE_SELECT, withSignedHousePhotos, type HouseRow } from "@/lib/houses";
import { SKILL_SELECT, signPaths, type SkillRow } from "@/lib/skills";
import type { DirectoryMember } from "@/lib/directory";

type OwnerWithProfile = { id: string; display_name: string | null; photo_url: string | null; profile_completed: boolean };

type Featured = {
  homes: Awaited<ReturnType<typeof withSignedHousePhotos>>;
  members: DirectoryMember[];
  skills: Array<SkillRow & { photo?: string | null; hostPhoto?: string | null }>;
};

const EMPTY: Featured = { homes: [], members: [], skills: [] };

/** Home: three featured rails — newest homes, newest members, newest skills; a rail hides itself when empty. */
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
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(12);
      // Newest members with completed profiles, excluding the signed-in member.
      const membersRes = supabase
        .from("profiles")
        .select("id,display_name,photo_url,location,intentions,created_at")
        .eq("profile_completed", true)
        .neq("id", profile!.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(6);
      // Newest published skills.
      const skillsRes = supabase
        .from("skills")
        .select(SKILL_SELECT)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(6);

      const [homes, members, skills] = await Promise.all([homesRes, membersRes, skillsRes]);
      if (homes.error) throw homes.error;
      if (members.error) throw members.error;
      if (skills.error) throw skills.error;

      const homeRows = ((homes.data ?? []) as unknown as Array<HouseRow & { owner?: OwnerWithProfile | null }>)
        .filter((h) => h.owner?.profile_completed).slice(0, 3);
      const memberRows = ((members.data ?? []) as DirectoryMember[]).slice(0, 3);
      const skillRows = ((skills.data ?? []) as SkillRow[]).slice(0, 3);

      const [signedHomes, signedSkills] = await Promise.all([
        withSignedHousePhotos(homeRows),
        (async () => {
          const sign = await signPaths(skillRows.flatMap((s) => [s.photo_url, s.owner?.photo_url]));
          return skillRows.map((s) => ({ ...s, photo: sign(s.photo_url), hostPhoto: sign(s.owner?.photo_url) }));
        })(),
      ]);
      const avatarSign = await signPaths(memberRows.map((m) => m.photo_url));
      return {
        homes: signedHomes,
        members: memberRows.map((m) => ({ ...m, photo: m.photo_url?.startsWith("http") ? m.photo_url : avatarSign(m.photo_url) })),
        skills: signedSkills,
      };
    },
  });

  const data = q.data ?? EMPTY;
  if (q.isLoading || q.isError) return null;
  const rails: Array<{ key: string; label: string; items: React.ReactNode[] }> = [];
  if (data.homes.length) rails.push({ key: "homes", label: "Featured homes", items: data.homes.map((h) => <HouseCard key={h.id} house={h} />) });
  if (data.members.length) rails.push({ key: "members", label: "Featured members", items: data.members.map((m) => <MemberCard key={m.id} member={m} />) });
  if (data.skills.length) rails.push({ key: "skills", label: "Featured skills", items: data.skills.map((s) => <SkillCard key={s.id} skill={s} />) });
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

function MemberCard({ member }: { member: DirectoryMember }) {
  return (
    <Link to="/members/$memberId" params={{ memberId: member.id }} className="surface-card discovery-card group flex flex-col items-center p-6 text-center">
      <MemberAvatar src={member.photo} name={member.display_name} className="size-24" />
      <p className="mt-4 font-serif text-2xl text-foreground group-hover:text-primary">{member.display_name ?? "Oka member"}</p>
      {member.location && (
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 text-primary" strokeWidth={1.5} />{member.location}
        </p>
      )}
      {member.intentions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {member.intentions.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">{t}</span>
          ))}
          {member.intentions.length > 3 && <span className="px-1 text-xs text-muted-foreground">+{member.intentions.length - 3}</span>}
        </div>
      )}
    </Link>
  );
}
