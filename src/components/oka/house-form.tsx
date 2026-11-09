import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { PROPERTY_LABELS, PROPERTY_TYPES, type HouseRow, type PropertyType } from "@/lib/houses";
import { signPaths } from "@/lib/skills";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 12;
const pill = (on: boolean) =>
  cn("rounded-full border px-4 py-1.5 text-sm transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary");
function L({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{children}</p>;
}

export function HouseForm({ userId, initial }: { userId: string; initial?: HouseRow }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    title: initial?.title ?? "",
    property_type: (initial?.property_type ?? "entire_home") as PropertyType,
    location_text: initial?.location_text ?? "",
    description: initial?.description ?? "",
    house_rules: initial?.house_rules ?? "",
  });
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(0);
  const [photoError, setPhotoError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const missing = photos.filter((p) => !previews[p]);
    if (!missing.length) return;
    void signPaths(missing).then((sign) =>
      setPreviews((prev) => ({ ...prev, ...Object.fromEntries(missing.map((p) => [p, sign(p) ?? ""])) })),
    );
  }, [photos, previews]);

  async function uploadMany(files: FileList) {
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (!list.length) { toast.error(`Up to ${MAX_PHOTOS} photos per home.`); return; }
    setUploading(list.length);
    const results = await Promise.all(list.map(async (file) => {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return null;
      const path = `${userId}/houses/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file);
      return error ? null : path;
    }));
    setUploading(0);
    const ok = results.filter((p): p is string => !!p);
    if (ok.length < list.length) toast.error("Some photos didn't upload — images under 5 MB only.");
    setPhotos((p) => [...p, ...ok]);
    if (ok.length) setPhotoError(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) { toast.error("Please give your home a title."); return; }
    if (!photos.length) { setPhotoError(true); toast.error("Please add at least one photo for your home."); return; }
    setBusy(true);
    const payload = {
      title: f.title.trim().slice(0, 120),
      property_type: f.property_type,
      location_text: f.location_text.trim().slice(0, 160) || null,
      description: f.description.trim().slice(0, 4000) || null,
      house_rules: f.house_rules.trim().slice(0, 2000) || null,
      photos,
    };
    const res = initial
      ? await supabase.from("houses").update(payload).eq("id", initial.id).select("id").single()
      : await supabase.from("houses").insert({ ...payload, owner_id: userId, status: "published" }).select("id").single();
    setBusy(false);
    if (res.error || !res.data) { toast.error("Your home didn't save. Please try again."); return; }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["houses"] }),
      qc.invalidateQueries({ queryKey: ["house", res.data.id] }),
      qc.invalidateQueries({ queryKey: ["my-houses"] }),
    ]);
    toast.success(initial ? "Your home is updated" : "Your home is open to the family");
    // New homes land on My Profile, which every member can open before launch.
    if (initial) void navigate({ to: "/houses/$houseId", params: { houseId: res.data.id } });
    else void navigate({ to: "/profile" });
  }

  return (
    <form onSubmit={submit} className="surface-card grid gap-6 p-6">
      <div>
        <L>Photos (required)</L>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((p, i) => (
            <div key={p} className="relative">
              {previews[p] ? <img src={previews[p]} alt="" className="aspect-square w-full rounded-2xl object-cover" /> : <div className="aspect-square w-full rounded-2xl bg-secondary" />}
              {i === 0 && <span className="absolute bottom-2 left-2 rounded-full bg-card px-2 py-0.5 text-[10px] uppercase tracking-widest">Cover</span>}
              <button type="button" aria-label="Remove photo" onClick={() => setPhotos((x) => x.filter((y) => y !== p))} className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-card shadow-soft">
                <X className="size-3.5 text-primary" strokeWidth={1.5} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading > 0} className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary/50">
              {uploading ? <Loader2 className="size-5 animate-spin text-primary" strokeWidth={1.5} /> : <ImagePlus className="size-5 text-primary" strokeWidth={1.5} />}
              {uploading ? `Uploading ${uploading}` : "Add photos"}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) void uploadMany(e.target.files); e.target.value = ""; }} />
        {photoError && !photos.length && <p className="text-sm text-destructive">Please add at least one photo for your home.</p>}
      </div>
      <div><L>Title</L><Input required maxLength={120} placeholder="e.g. Sunlit room above the olive grove" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div>
        <L>Property type</L>
        <div className="flex gap-2">{PROPERTY_TYPES.map((t) => <button key={t} type="button" className={pill(f.property_type === t)} onClick={() => setF({ ...f, property_type: t })}>{PROPERTY_LABELS[t]}</button>)}</div>
      </div>
      <div><L>Location</L><Input maxLength={160} placeholder="Neighbourhood, city, country" value={f.location_text} onChange={(e) => setF({ ...f, location_text: e.target.value })} /></div>
      <div><L>Description</L><Textarea rows={6} maxLength={4000} placeholder="What's it like to stay with you?" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div><L>House rules</L><Textarea rows={4} maxLength={2000} placeholder="Shoes off, quiet after 10, the cat is in charge…" value={f.house_rules} onChange={(e) => setF({ ...f, house_rules: e.target.value })} /></div>
      <p className="text-sm text-muted-foreground">Each night hosted earns you one credit.</p>
      <div className="flex justify-end">
        <Button type="submit" className="rounded-full px-8" disabled={busy || uploading > 0}>
          {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}{initial ? "Save changes" : "Open my home"}
        </Button>
      </div>
    </form>
  );
}
