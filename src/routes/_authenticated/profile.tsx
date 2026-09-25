import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar, ProfileSections } from "@/components/oka/profile-sections";
import { TagInput } from "@/components/oka/tag-input";
import { MyOfferings } from "@/components/oka/my-offerings";
import { MyHouses } from "@/components/oka/my-houses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { resolvePhotoUrl, useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { AGE_RANGES, INTENTIONS, RELATIONSHIP_STATUSES, profileCompleteness, type OkaProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Oka" },
      { name: "description", content: "Your presence in the Oka family." },
      { property: "og:title", content: "My Profile — Oka" },
      { property: "og:description", content: "Your presence in the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type Draft = Pick<
  OkaProfile,
  | "display_name" | "photo_url" | "age_range" | "location" | "relationship_status" | "profession"
  | "gift_excited_to_give" | "gift_loved_gestures"
> & { intentions: string[]; skill_tags: string[]; travel_frequent: string[]; travel_desired: string[] };

function toDraft(p: OkaProfile): Draft {
  return {
    display_name: p.display_name, photo_url: p.photo_url, age_range: p.age_range, location: p.location,
    relationship_status: p.relationship_status, profession: p.profession,
    gift_excited_to_give: p.gift_excited_to_give, gift_loved_gestures: p.gift_loved_gestures,
    intentions: p.intentions ?? [], skill_tags: p.skill_tags ?? [],
    travel_frequent: p.travel_frequent ?? [], travel_desired: p.travel_desired ?? [],
  };
}

function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const [editing, setEditing] = useState(false);
  const { data: photo } = useQuery({
    queryKey: ["profile-photo", profile?.photo_url],
    queryFn: () => resolvePhotoUrl(profile?.photo_url ?? null),
    enabled: Boolean(profile),
  });

  if (isLoading || !profile) {
    return <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>;
  }

  const completeness = profileCompleteness(profile);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <p className="section-label">My Profile</p>
      <div className="mt-6 flex flex-wrap items-center gap-6">
        <MemberAvatar src={photo} name={profile.display_name} className="size-24" />
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl text-foreground">{profile.display_name ?? "Welcome"}</h1>
          <Link to="/members/$memberId" params={{ memberId: profile.id }} className="mt-1 inline-block text-sm text-primary hover:underline">
            See how others see you
          </Link>
        </div>
        {!editing && (
          <Button className="rounded-full px-6" onClick={() => setEditing(true)}>
            <Pencil className="size-4" strokeWidth={1.5} /> Edit profile
          </Button>
        )}
      </div>

      <div className="surface-card mt-8 p-6">
        <p className="section-label">Your presence</p>
        <Progress value={completeness} className="mt-3" />
        <p className="mt-3 text-sm text-muted-foreground">
          {completeness === 100
            ? "Your profile is whole — the family can truly meet you."
            : `${completeness}% shared. Each detail helps the family know you a little better.`}
        </p>
      </div>

      <div className="mt-6">
        {editing ? <ProfileEditor profile={profile} onDone={() => setEditing(false)} /> : <><ProfileSections profile={profile} /><MyOfferings userId={profile.id} /><MyHouses userId={profile.id} /></>}
      </div>
    </div>
  );
}

function Pills({ options, value, onChange }: { options: readonly string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? null : o)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors",
            value === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Block({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="surface-card space-y-5 p-6">
      <div>
        <p className="section-label">{label}</p>
        {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{children}</p>;
}

function ProfileEditor({ profile, onDone }: { profile: OkaProfile; onDone: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    let alive = true;
    void resolvePhotoUrl(draft.photo_url).then((u) => alive && setPreview(u));
    return () => { alive = false; };
  }, [draft.photo_url]);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image.");
    if (file.size > 5 * 1024 * 1024) return void toast.error("Please choose a photo under 5 MB.");
    setUploading(true);
    const path = `${profile.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) return void toast.error("That photo didn't upload. Please try again.");
    set("photo_url", path);
  }

  const completeness = profileCompleteness(draft);

  async function save() {
    setSaving(true);
    const clean = (s: string | null) => (s?.trim() ? s.trim() : null);
    const payload = {
      ...draft,
      display_name: clean(draft.display_name),
      location: clean(draft.location),
      profession: clean(draft.profession),
      gift_excited_to_give: clean(draft.gift_excited_to_give),
      gift_loved_gestures: clean(draft.gift_loved_gestures),
      // Once every section is shared, mark the profile complete (never unset).
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
    setSaving(false);
    if (error) return void toast.error("Your changes didn't save. Please try again.");
    await qc.invalidateQueries({ queryKey: ["profile"] });
    await qc.invalidateQueries({ queryKey: ["directory"] });
    await qc.invalidateQueries({ queryKey: ["member", profile.id] });
    toast.success("Your profile is updated");
    onDone();
  }

  return (
    <div className="grid gap-6">
      <Block label="Basic details">
        <div className="flex items-center gap-5">
          <MemberAvatar src={preview} name={draft.display_name} className="size-20" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          <Button type="button" variant="outline" className="rounded-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : <Camera className="size-4 text-primary" strokeWidth={1.5} />}
            {draft.photo_url ? "Change photo" : "Upload photo"}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><FieldLabel>Name</FieldLabel><Input maxLength={80} value={draft.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} /></div>
          <div><FieldLabel>Location</FieldLabel><Input maxLength={120} placeholder="City, country" value={draft.location ?? ""} onChange={(e) => set("location", e.target.value)} /></div>
          <div className="sm:col-span-2"><FieldLabel>Profession</FieldLabel><Input maxLength={120} value={draft.profession ?? ""} onChange={(e) => set("profession", e.target.value)} /></div>
        </div>
        <div><FieldLabel>Age range</FieldLabel><Pills options={AGE_RANGES} value={draft.age_range} onChange={(v) => set("age_range", v)} /></div>
        <div><FieldLabel>Relationship status</FieldLabel><Pills options={RELATIONSHIP_STATUSES} value={draft.relationship_status} onChange={(v) => set("relationship_status", v)} /></div>
      </Block>

      <Block label="Intentions & seeking" hint="What draws you to the family? Choose any, or add your own.">
        <TagInput value={draft.intentions} onChange={(v) => set("intentions", v)} suggestions={INTENTIONS} />
      </Block>

      <Block label="The gift economy" hint="In Oka, we give freely. What would you love to offer, and what makes you feel cared for?">
        <div>
          <FieldLabel>What I'm excited to give</FieldLabel>
          <Textarea rows={4} maxLength={1000} placeholder="Professional expertise, physical gifts, acts of service…" value={draft.gift_excited_to_give ?? ""} onChange={(e) => set("gift_excited_to_give", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Gestures that make me feel loved when hosting</FieldLabel>
          <Textarea rows={4} maxLength={1000} placeholder="A home-cooked meal, a handwritten note, help in the garden…" value={draft.gift_loved_gestures ?? ""} onChange={(e) => set("gift_loved_gestures", e.target.value)} />
        </div>
      </Block>

      <Block label="Skills & expertise" hint="Press Enter after each one.">
        <TagInput value={draft.skill_tags} onChange={(v) => set("skill_tags", v)} placeholder="e.g. Pottery, Yoga, Web design" />
      </Block>

      <Block label="Travel">
        <div><FieldLabel>Places I often visit</FieldLabel><TagInput value={draft.travel_frequent} onChange={(v) => set("travel_frequent", v)} placeholder="e.g. Lisbon" /></div>
        <div><FieldLabel>Places I dream of going</FieldLabel><TagInput value={draft.travel_desired} onChange={(v) => set("travel_desired", v)} placeholder="e.g. Kyoto" /></div>
      </Block>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-4 shadow-lifted lg:bottom-6">
        <p className="text-sm text-muted-foreground">{completeness}% shared</p>
        <div className="flex gap-3">
          <Button variant="ghost" className="rounded-full" onClick={onDone} disabled={saving}>Cancel</Button>
          <Button className="rounded-full px-6" onClick={save} disabled={saving || uploading}>
            {saving && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />} Save profile
          </Button>
        </div>
      </div>
    </div>
  );
}
