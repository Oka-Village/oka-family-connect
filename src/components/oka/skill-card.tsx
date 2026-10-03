import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Sparkles, Video } from "lucide-react";

import { FavoriteButton } from "@/components/oka/favorite-button";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { SKILL_FORMAT_LABELS, formatDuration, type SkillRow } from "@/lib/skills";

export function SkillCard({ skill }: { skill: SkillRow & { photo?: string | null; hostPhoto?: string | null } }) {
  const FormatIcon = skill.format === "virtual" ? Video : MapPin;
  return (
    <div className="relative h-full">
    <Link
      to="/skills/$skillId"
      params={{ skillId: skill.id }}
      className="surface-card discovery-card group flex h-full flex-col overflow-hidden"
    >
      {skill.photo ? (
        <img src={skill.photo} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-accent/60">
          <Sparkles className="size-10 text-primary" strokeWidth={1.25} />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          {skill.category && (
            <span className="rounded-full bg-secondary px-3 py-0.5 text-xs uppercase tracking-widest text-secondary-foreground">{skill.category}</span>
          )}
          <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            <FormatIcon className="size-3 text-primary" strokeWidth={1.5} />{SKILL_FORMAT_LABELS[skill.format]}
          </span>
        </div>
        <h3 className="mt-3 font-serif text-2xl leading-tight text-foreground group-hover:text-primary">{skill.title}</h3>
        {skill.duration_minutes && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5 text-primary" strokeWidth={1.5} />{formatDuration(skill.duration_minutes)}
          </p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-5">
          <MemberAvatar src={skill.hostPhoto} name={skill.owner?.display_name} className="size-7" />
          <span className="text-sm text-foreground">{skill.owner?.display_name ?? "Oka member"}</span>
        </div>
      </div>
    </Link>
    <FavoriteButton type="skill" itemRef={skill.id} className="absolute right-3 top-3" />
    </div>
  );
}
