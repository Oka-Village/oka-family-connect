import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/oka/profile-sections";
import { TagInput } from "@/components/oka/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resolvePhotoUrl } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { AGE_RANGES, INTENTIONS, RELATIONSHIP_STATUSES, type OkaProfile } from "@/lib/profile";
import { adminDeleteMember } from "@/lib/admin-members.functions";

export function AdminMemberPhoto({ photoUrl, name }: { photoUrl: string | null; name: string | null }) {
  const { data } = useQuery({ queryKey: ["profile-photo", photoUrl], queryFn: () => resolvePhotoUrl(photoUrl), enabled: Boolean(photoUrl) });
  return <MemberAvatar src={data ?? null} name={name} className="size-12 shrink-0" />;
}

const TEXT_FIELDS = [
  ["display_name", "Name"], ["location", "Location"], ["profession", "Profession"], ["photo_url", "Photo (path or URL)"],
] as const;
const LIST_FIELDS = [
  ["skill_tags", "Skills"], ["travel_frequent", "Frequent places"], ["travel_desired", "Dream places"],
] as const;

export function AdminEditProfile({ userId, onDone }: { userId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: p } = useQuery({
    queryKey: ["admin", "profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      return data as OkaProfile;
    },
  });
  const [draft, setDraft] = useState<Partial<OkaProfile> | null>(null);
  const [busy, setBusy] = useState(false);
  if (!p) return <p className="w-full text-sm text-muted-foreground">Loading profile…</p>;
  const d = { ...p, ...draft };
  const set = (k: keyof OkaProfile, v: unknown) => setDraft((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return onDone();
    setBusy(true);
    const { error } = await supabase.from("profiles").update(draft as never).eq("id", userId).select("id").single();
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Profile saved");
    await qc.invalidateQueries();
    onDone();
  }

  const select = "h-10 w-full rounded-full border border-input bg-background px-4 text-sm";
  return (
    <form onSubmit={save} className="grid w-full gap-4 border-t border-border pt-4 sm:grid-cols-2">
      {TEXT_FIELDS.map(([k, label]) => (
        <label key={k} className="grid gap-1 text-sm text-muted-foreground">{label}
          <Input value={(d[k] as string | null) ?? ""} onChange={(e) => set(k, e.target.value || null)} className="rounded-full" />
        </label>
      ))}
      <label className="grid gap-1 text-sm text-muted-foreground">Age range
        <select className={select} value={d.age_range ?? ""} onChange={(e) => set("age_range", e.target.value || null)}>
          <option value="">—</option>{AGE_RANGES.map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm text-muted-foreground">Relationship
        <select className={select} value={d.relationship_status ?? ""} onChange={(e) => set("relationship_status", e.target.value || null)}>
          <option value="">—</option>{RELATIONSHIP_STATUSES.map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm text-muted-foreground">Membership
        <select className={select} value={d.membership_tier} onChange={(e) => set("membership_tier", e.target.value)}>
          <option value="free">Free</option><option value="full">Full</option>
        </select>
      </label>
      <fieldset className="grid gap-2 text-sm text-muted-foreground sm:col-span-2">Intentions
        <div className="flex flex-wrap gap-3">
          {INTENTIONS.map((i) => {
            const cur = d.intentions ?? [];
            return (
              <label key={i} className="flex items-center gap-1.5 text-foreground">
                <input type="checkbox" checked={cur.includes(i)} onChange={(e) => set("intentions", e.target.checked ? [...cur, i] : cur.filter((x) => x !== i))} /> {i}
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm text-muted-foreground sm:col-span-2">Gift they're excited to give
        <Textarea value={d.gift_excited_to_give ?? ""} onChange={(e) => set("gift_excited_to_give", e.target.value || null)} />
      </label>
      <label className="grid gap-1 text-sm text-muted-foreground sm:col-span-2">Gestures they love
        <Textarea value={d.gift_loved_gestures ?? ""} onChange={(e) => set("gift_loved_gestures", e.target.value || null)} />
      </label>
      {LIST_FIELDS.map(([k, label]) => (
        <div key={k} className="grid gap-1 text-sm text-muted-foreground sm:col-span-2">{label}
          <TagInput value={(d[k] as string[] | null) ?? []} onChange={(v: string[]) => set(k, v)} />
        </div>
      ))}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" className="rounded-full" disabled={busy}>Save profile</Button>
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function AdminDeleteMember({ userId, name }: { userId: string; name: string | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!confirm(`Permanently delete ${name || "this member"}? Their account, listings, bookings and credits are removed. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await adminDeleteMember({ data: { userId } });
      toast.success("Member deleted");
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <Button size="sm" variant="outline" className="rounded-full text-destructive" disabled={busy} onClick={run}>Delete member</Button>;
}

export function useSuspendedIds() {
  return useQuery({
    queryKey: ["admin", "suspensions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("member_suspensions").select("user_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id));
    },
  });
}

export function AdminSuspendMember({ userId, suspended }: { userId: string; suspended: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!suspended && !confirm("Suspend this member? They won't be able to use Oka until you lift it.")) return;
    setBusy(true);
    const { error } = suspended
      ? await supabase.from("member_suspensions").delete().eq("user_id", userId)
      : await supabase.from("member_suspensions").insert({ user_id: userId });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(suspended ? "Suspension lifted" : "Member suspended");
    qc.invalidateQueries({ queryKey: ["admin", "suspensions"] });
  }
  return <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={run}>{suspended ? "Lift suspension" : "Suspend"}</Button>;
}

export function BlockedEmails() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "blocked-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocked_emails").select("email,created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  async function unblock(email: string) {
    if (!confirm(`Allow ${email} to join again?`)) return;
    const { error } = await supabase.from("blocked_emails").delete().eq("email", email);
    if (error) return void toast.error(error.message);
    toast.success("Email unblocked");
    qc.invalidateQueries({ queryKey: ["admin", "blocked-emails"] });
  }
  if (!q.data?.length) return null;
  return (
    <div className="mt-12">
      <p className="section-label">Blocked emails (deleted members)</p>
      <ul className="mt-4 grid gap-2">
        {q.data.map((b) => (
          <li key={b.email} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-3 shadow-soft">
            <span className="text-sm text-foreground">{b.email}</span>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => unblock(b.email)}>Unblock</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
