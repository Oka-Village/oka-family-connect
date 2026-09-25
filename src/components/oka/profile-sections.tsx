import { Gift, Heart, MapPin, Plane, Sparkles, User } from "lucide-react";

import { TagList } from "@/components/oka/tag-input";
import type { OkaProfile } from "@/lib/profile";

export function MemberAvatar({ src, name, className = "size-20" }: { src: string | null | undefined; name?: string | null; className?: string }) {
  return src ? (
    <img src={src} alt={name ?? "Member photo"} className={`${className} rounded-full object-cover`} />
  ) : (
    <span className={`${className} flex items-center justify-center rounded-full bg-secondary`}>
      <User className="size-1/3 text-primary" strokeWidth={1.5} />
    </span>
  );
}

function Section({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-6">
      <p className="section-label flex items-center gap-2"><Icon className="size-4 text-primary" strokeWidth={1.5} />{label}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-line text-foreground">{value?.trim() || <span className="text-sm text-muted-foreground">Not shared yet</span>}</p>
    </div>
  );
}

/** Read-only rendering of every profile section; shared by My Profile and member pages. */
export function ProfileSections({ profile }: { profile: OkaProfile }) {
  return (
    <div className="grid gap-6">
      <Section icon={MapPin} label="Basic details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" value={profile.location} />
          <Field label="Age range" value={profile.age_range} />
          <Field label="Relationship status" value={profile.relationship_status} />
          <Field label="Profession" value={profile.profession} />
        </div>
      </Section>
      <Section icon={Heart} label="Intentions & seeking">
        <TagList tags={profile.intentions} />
      </Section>
      <Section icon={Gift} label="The gift economy">
        <Field label="What I'm excited to give" value={profile.gift_excited_to_give} />
        <Field label="Gestures that make me feel loved when hosting" value={profile.gift_loved_gestures} />
      </Section>
      <Section icon={Sparkles} label="Skills & expertise">
        <TagList tags={profile.skill_tags} />
      </Section>
      <Section icon={Plane} label="Travel">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Often found in</p>
          <TagList tags={profile.travel_frequent} />
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Dreaming of</p>
          <TagList tags={profile.travel_desired} />
        </div>
      </Section>
    </div>
  );
}
