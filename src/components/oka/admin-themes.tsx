import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { THEME_BUCKET, currentKey, periodLabel, useTheme, type ThemeKind } from "@/lib/themes";
import { cn } from "@/lib/utils";

function LivePreview({ kind }: { kind: ThemeKind }) {
  const { data, isLoading } = useTheme(kind);
  return (
    <div className="surface-card flex items-center gap-4 p-4">
      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">{data?.imageUrl && <img src={data.imageUrl} alt="" className="size-full object-cover" />}</div>
      <div className="min-w-0">
        <p className="section-label">Live {kind === "month" ? "this month" : "this week"} · {periodLabel(kind, currentKey(kind))}</p>
        <p className="mt-1 truncate font-serif text-xl text-foreground">{isLoading ? "…" : data?.title ?? "Nothing set yet"}</p>
      </div>
    </div>
  );
}

export function ThemesSection() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ThemeKind>("month");
  const [key, setKey] = useState(currentKey("month"));
  const existing = useTheme(kind, key);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = kind === "month" ? /^\d{4}-(0[1-9]|1[0-2])$/.test(key) : /^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$/.test(key);

  useEffect(() => {
    setTitle(existing.data?.title ?? "");
    setBody(existing.data?.body ?? "");
    setFile(null);
  }, [existing.data, kind, key]);

  async function save() {
    if (!title.trim() || !valid) return;
    setSaving(true);
    try {
      let image_path = existing.data?.image_path ?? null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        image_path = `${kind}/${key}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from(THEME_BUCKET).upload(image_path, file, { contentType: file.type });
        if (error) throw error;
      }
      const { error } = await supabase.from("themes").upsert({ kind, period_key: key, title: title.trim(), body: body.trim() || null, image_path }, { onConflict: "kind,period_key" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["theme"] });
      toast.success("Theme saved");
    } catch {
      toast.error("Couldn't save the theme. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-10 flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2"><LivePreview kind="month" /><LivePreview kind="week" /></div>
      <div className="surface-card flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-end gap-3">
          {(["month", "week"] as const).map((k) => (
            <button key={k} type="button" onClick={() => { setKind(k); setKey(currentKey(k)); }} className={cn("rounded-full border px-4 py-2 text-sm", kind === k ? "border-transparent bg-secondary text-secondary-foreground" : "border-border text-muted-foreground")}>{k === "month" ? "Month" : "Week"}</button>
          ))}
          <label className="flex flex-col gap-1 text-sm text-muted-foreground">
            {kind === "month" ? "Month (YYYY-MM)" : "ISO week (YYYY-WW)"}
            <Input value={key} onChange={(e) => setKey(e.target.value.trim())} className="w-36 rounded-full" aria-invalid={!valid} />
          </label>
          {valid && <span className="pb-2 text-sm text-muted-foreground">{periodLabel(kind, key)}</span>}
        </div>
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">Title<Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">Body<Textarea value={body} maxLength={600} rows={4} onChange={(e) => setBody(e.target.value)} /></label>
        <div className="flex flex-wrap items-center gap-4">
          {(file || existing.data?.imageUrl) && <img src={file ? URL.createObjectURL(file) : existing.data!.imageUrl!} alt="" className="size-20 rounded-xl object-cover" />}
          <label className="flex flex-col gap-1 text-sm text-muted-foreground">Image<Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        </div>
        <div><Button className="rounded-full" disabled={saving || !title.trim() || !valid} onClick={save}>{saving ? "Saving…" : existing.data ? "Update theme" : "Save theme"}</Button></div>
      </div>
    </section>
  );
}
