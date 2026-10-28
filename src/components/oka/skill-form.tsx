import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { SKILL_CATEGORIES, SKILL_FORMATS, SKILL_FORMAT_LABELS, signPaths, type SkillFormat, type SkillRow } from "@/lib/skills";
import { cn } from "@/lib/utils";

const pill = (on: boolean) =>
  cn("rounded-full border px-4 py-1.5 text-sm transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary");

function L({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{children}</p>;
}

export function SkillForm({ userId, initial }: { userId: string; initial?: SkillRow }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    title: initial?.title ?? "",
    category: initial?.category ?? "",
    format: (initial?.format ?? "virtual") as SkillFormat,
    duration: String(initial?.duration_minutes ?? 60),
    description: initial?.description ?? "",
    photo_url: initial?.photo_url ?? null as string | null,
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    let alive = true;
    void signPaths([f.photo_url]).then((sign) => alive && setPreview(sign(f.photo_url)));
    return () => { alive = false; };
  }, [f.photo_url]);

  async function upload(file: File) {
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast.error("Please choose an image under 5 MB.");
      return;
    }
    setUploading(true);
    const path = `${userId}/skills/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file);
    setUploading(false);
    if (error) { toast.error("That photo didn't upload. Please try again."); return; }
    setF((x) => ({ ...x, photo_url: path }));
    setPhotoError(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const duration = Number.parseInt(f.duration, 10);
    if (!f.title.trim()) { toast.error("Please give your offering a title."); return; }
    if (!f.photo_url) { setPhotoError(true); toast.error("Please add a photo for your offering."); return; }
    if (!Number.isFinite(duration) || duration < 15 || duration > 480) { toast.error("Duration should be between 15 and 480 minutes."); return; }
    setBusy(true);
    const payload = {
      title: f.title.trim().slice(0, 120),
      category: f.category || null,
      format: f.format,
      duration_minutes: duration,
      description: f.description.trim().slice(0, 3000) || null,
      photo_url: f.photo_url,
    };
    const res = initial
      ? await supabase.from("skills").update(payload).eq("id", initial.id).select("id").single()
      : await supabase.from("skills").insert({ ...payload, owner_id: userId, status: "published" }).select("id").single();
    setBusy(false);
    if (res.error || !res.data) { toast.error("Your offering didn't save. Please try again."); return; }
    await qc.invalidateQueries({ queryKey: ["skills"] });
    await qc.invalidateQueries({ queryKey: ["skill", res.data.id] });
    await qc.invalidateQueries({ queryKey: ["my-skills"] });
    toast.success(initial ? "Your offering is updated" : "Your offering is live");
    void navigate({ to: "/skills/$skillId", params: { skillId: res.data.id } });
  }

  return (
    <form onSubmit={submit} className="surface-card grid gap-6 p-6">
      <div className="flex items-center gap-5">
        {preview ? <img src={preview} alt="" className="size-24 rounded-2xl object-cover" /> : <div className="size-24 rounded-2xl bg-accent/60" />}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) void upload(x); e.target.value = ""; }} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : <Camera className="size-4 text-primary" strokeWidth={1.5} />}
            {f.photo_url ? "Change photo" : "Add a photo (required)"}
          </Button>
          {f.photo_url && <Button type="button" variant="ghost" className="rounded-full" onClick={() => setF((x) => ({ ...x, photo_url: null }))}>Remove</Button>}
        </div>
        {photoError && !f.photo_url && <p className="text-sm text-destructive">Please add a photo for your offering.</p>}
      </div>
      <div><L>Title</L><Input required maxLength={120} placeholder="e.g. Sourdough from scratch" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div>
        <L>Category</L>
        <div className="flex flex-wrap gap-2">
          {SKILL_CATEGORIES.map((c) => <button key={c} type="button" className={pill(f.category === c)} onClick={() => setF({ ...f, category: f.category === c ? "" : c })}>{c}</button>)}
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <L>Format</L>
          <div className="flex gap-2">
            {SKILL_FORMATS.map((x) => <button key={x} type="button" className={pill(f.format === x)} onClick={() => setF({ ...f, format: x })}>{SKILL_FORMAT_LABELS[x]}</button>)}
          </div>
        </div>
        <div><L>Duration (minutes)</L><Input type="number" min={15} max={480} step={15} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></div>
      </div>
      <div><L>Description</L><Textarea rows={6} maxLength={3000} placeholder="What will you share, and what might someone take away?" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <p className="text-sm text-muted-foreground">Each session is exchanged for one credit.</p>
      <div className="flex justify-end">
        <Button type="submit" className="rounded-full px-8" disabled={busy || uploading}>
          {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}{initial ? "Save changes" : "Publish offering"}
        </Button>
      </div>
    </form>
  );
}
