import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, Clock, Coins, Loader2, MapPin, Pencil, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/oka/profile-sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { SKILL_FORMAT_LABELS, SKILL_SELECT, formatDuration, sessionErrorMessage, signPaths, useCredits, type SkillRow } from "@/lib/skills";

export const Route = createFileRoute("/_authenticated/skills/$skillId")({
  head: () => ({
    meta: [
      { title: "Skill — Oka" },
      { name: "description", content: "A skill shared in the Oka family." },
      { property: "og:title", content: "Skill — Oka" },
      { property: "og:description", content: "A skill shared in the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SkillDetail,
});

function SkillDetail() {
  const { skillId } = Route.useParams();
  const { data: uid } = useCurrentUserId();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["skill", skillId],
    queryFn: async () => {
      const { data, error } = await supabase.from("skills").select(SKILL_SELECT).eq("id", skillId).maybeSingle();
      if (error) throw error;
      const skill = data as unknown as SkillRow | null;
      const sign = await signPaths([skill?.photo_url, skill?.owner?.photo_url]);
      return skill ? { skill, photo: sign(skill.photo_url), hostPhoto: sign(skill.owner?.photo_url) } : null;
    },
  });

  if (q.isLoading) return <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>;
  if (!q.data) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-3xl">This offering isn't available</h1>
        <Link to="/skills" className="mt-6 inline-block text-primary">Back to skills</Link>
      </div>
    );
  }
  const { skill, photo, hostPhoto } = q.data;
  const mine = skill.owner_id === uid;
  const FormatIcon = skill.format === "virtual" ? Video : MapPin;

  async function setStatus(status: "published" | "archived") {
    const { error } = await supabase.from("skills").update({ status }).eq("id", skill.id);
    if (error) { toast.error(error.message.includes("moderator") ? "This listing was unlisted by a moderator." : "That didn't work. Please try again."); return; }
    await qc.invalidateQueries({ queryKey: ["skill", skill.id] });
    await qc.invalidateQueries({ queryKey: ["skills"] });
    await qc.invalidateQueries({ queryKey: ["my-skills"] });
    toast.success(status === "archived" ? "Offering archived" : "Offering is live again");
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
      <Link to="/skills" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> All skills
      </Link>
      {skill.status !== "published" && (
        <div className="mt-6 rounded-2xl bg-golden/25 px-5 py-3 text-sm text-foreground">This offering is archived and hidden from the skills list.</div>
      )}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          {photo ? (
            <img src={photo} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover shadow-soft" />
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-accent/60"><Sparkles className="size-12 text-primary" strokeWidth={1.25} /></div>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {skill.category && <span className="rounded-full bg-secondary px-3 py-1 text-xs uppercase tracking-widest text-secondary-foreground">{skill.category}</span>}
            <span className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"><FormatIcon className="size-3 text-primary" strokeWidth={1.5} />{SKILL_FORMAT_LABELS[skill.format]}</span>
            {skill.duration_minutes && <span className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"><Clock className="size-3 text-primary" strokeWidth={1.5} />{formatDuration(skill.duration_minutes)}</span>}
          </div>
          <h1 className="mt-5 text-4xl leading-tight text-foreground lg:text-5xl">{skill.title}</h1>
          <p className="section-label mt-10">About this offering</p>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-foreground">{skill.description || "The host hasn't written a description yet."}</p>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="section-label">Offered by</p>
            <Link to="/members/$memberId" params={{ memberId: skill.owner_id }} className="mt-4 flex items-center gap-3 hover:text-primary">
              <MemberAvatar src={hostPhoto} name={skill.owner?.display_name} className="size-12" />
              <span className="font-serif text-xl">{skill.owner?.display_name ?? "Oka member"}</span>
            </Link>
          </div>
          {mine ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <p className="section-label">Your offering</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-full"><Link to="/skills/edit/$skillId" params={{ skillId: skill.id }}><Pencil className="size-4 text-primary" strokeWidth={1.5} />Edit</Link></Button>
                {skill.status === "published" ? (
                  <Button variant="outline" className="rounded-full" onClick={() => void setStatus("archived")}><Archive className="size-4 text-primary" strokeWidth={1.5} />Archive</Button>
                ) : (
                  <Button variant="outline" className="rounded-full" onClick={() => void setStatus("published")}><ArchiveRestore className="size-4 text-primary" strokeWidth={1.5} />Publish again</Button>
                )}
              </div>
              <Link to="/sessions" className="mt-4 inline-block text-sm text-primary hover:underline">See requests in Sessions</Link>
            </div>
          ) : skill.status === "published" ? (
            <RequestForm skillId={skill.id} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function RequestForm({ skillId }: { skillId: string }) {
  const qc = useQueryClient();
  const credits = useCredits();
  const [when, setWhen] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const available = credits.data?.available ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const at = when ? new Date(when) : null;
    if (!at || Number.isNaN(at.getTime()) || at < new Date()) { setNotice("Please propose a time in the future."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("request_skill_session", { _skill_id: skillId, _proposed_at: at.toISOString(), _message: message.trim().slice(0, 1000) });
    setBusy(false);
    await qc.invalidateQueries({ queryKey: ["credits"] });
    if (error) { setNotice(sessionErrorMessage(error)); return; }
    await qc.invalidateQueries({ queryKey: ["sessions"] });
    setSent(true);
    toast.success("Your request is on its way");
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-secondary/60 p-6">
        <p className="section-label">Request sent</p>
        <p className="mt-3 text-foreground">Your host will reply soon. One credit is set aside and only moves once the session is complete.</p>
        <Link to="/sessions" className="mt-4 inline-block text-sm text-primary hover:underline">View your sessions</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <p className="section-label">Request a session</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Coins className="size-4 text-primary" strokeWidth={1.5} />1 credit · you have {credits.isLoading ? "…" : available} available
      </p>
      <label className="mt-5 block">
        <span className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">Proposed time</span>
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </label>
      <label className="mt-4 block">
        <span className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">A short note</span>
        <Textarea rows={4} maxLength={1000} placeholder="Say hello and share what you'd love to learn." value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {notice && <p className="mt-4 rounded-2xl bg-accent/70 px-4 py-3 text-sm text-foreground">{notice}</p>}
      <Button type="submit" className="mt-5 w-full rounded-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Send request
      </Button>
    </form>
  );
}
