import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { signPaths } from "@/lib/skills";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ImageCropDialog } from "@/components/oka/image-crop-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_FORMATS,
  EVENT_TYPES,
  FORMAT_LABELS,
  TYPE_LABELS,
  defaultTimezone,
  listTimezones,
  utcToZonedInput,
  zonedInputToUtc,
  type EventFormat,
  type EventRow,
  type EventType,
} from "@/lib/events";
import { MAX_OCCURRENCES, REPEAT_LABELS, occurrenceStarts, type Repeat } from "@/lib/recurrence";

type Props = {
  mode: "create" | "edit";
  isAdmin: boolean;
  userId: string;
  initial?: EventRow;
  initialLocation?: { venue_address: string | null; video_link: string | null; meeting_link: string | null } | null;
};

const selectCls =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function EventForm({ mode, isAdmin, userId, initial, initialLocation }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tz0 = initial?.timezone || defaultTimezone();
  const [f, setF] = useState({
    title: initial?.title ?? "",
    event_type: (initial?.event_type ?? "gathering") as EventType,
    format: (initial?.format ?? "virtual") as EventFormat,
    timezone: tz0,
    starts: initial ? utcToZonedInput(initial.starts_at, tz0) : "",
    ends: initial?.ends_at ? utcToZonedInput(initial.ends_at, tz0) : "",
    capacity: initial?.capacity?.toString() ?? "",
    venue: initialLocation?.venue_address ?? "",
    video: initialLocation?.video_link ?? "",
    meeting: initialLocation?.meeting_link ?? "",
    description: initial?.description ?? "",
    photo_url: initial?.photo_url ?? null as string | null,
  });
  // Create-mode drafts survive tab switches, reloads and accidental navigation.
  const DRAFT_KEY = `oka:event-draft:${userId}`;
  const draftReady = useRef(false);
  useEffect(() => {
    if (mode !== "create") return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) setF((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
    draftReady.current = true;
  }, [mode, DRAFT_KEY]);
  useEffect(() => {
    if (mode !== "create" || !draftReady.current) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch { /* ignore */ }
  }, [f, mode, DRAFT_KEY]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  useEffect(() => {
    let alive = true;
    void signPaths([f.photo_url]).then((sign) => alive && setPreview(sign(f.photo_url) ?? null));
    return () => { alive = false; };
  }, [f.photo_url]);
  async function upload(file: File) {
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return void toast.error("Please choose an image under 5 MB.");
    setUploading(true);
    const path = `${userId}/events/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file);
    setUploading(false);
    if (error) return void toast.error("That photo didn't upload. Please try again.");
    setF((x) => ({ ...x, photo_url: path }));
    setPhotoError(false);
  }
  const [saving, setSaving] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [until, setUntil] = useState("");
  const [pods, setPods] = useState(() => [1, 2, 3].map(() => ({ topic: "", starts: "", ends: "" })));
  const isPod = mode === "create" && f.event_type === "pod_session";
  const upPod = (i: number, k: "topic" | "starts" | "ends") => (e: { target: { value: string } }) =>
    setPods((p) => p.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submitPods(): Promise<unknown> {
    if (!f.title.trim()) return toast.error("Please add a title.");
    if (!f.photo_url) { setPhotoError(true); return toast.error("Please add a photo for your event."); }
    for (const [i, p] of pods.entries()) {
      if (!p.topic.trim() || !p.starts) return toast.error(`Please add a topic and start time for Session ${i + 1}.`);
      if (p.ends && p.ends < p.starts) return toast.error(`Session ${i + 1} must end after it starts.`);
    }
    if (f.meeting && !/^https?:\/\//.test(f.meeting) && f.format === "virtual") return toast.error("The meeting link should start with https://");
    const capacity = f.capacity ? Number(f.capacity) : null;
    if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) return toast.error("Capacity must be a whole number above zero.");
    setSaving(true);
    const rows = pods.map((p, i) => ({
      title: `${f.title.trim()} · Session ${i + 1}: ${p.topic.trim()}`.slice(0, 140),
      event_type: f.event_type,
      format: f.format,
      timezone: f.timezone,
      starts_at: zonedInputToUtc(p.starts, f.timezone),
      ends_at: p.ends ? zonedInputToUtc(p.ends, f.timezone) : null,
      capacity,
      description: f.description.trim() || null,
      photo_url: f.photo_url,
      created_by: userId,
      status: isAdmin ? "published" : "pending_approval",
    }));
    const { data, error } = await supabase.from("events").insert(rows).select("id,starts_at").order("starts_at");
    if (error || !data?.length) { setSaving(false); return toast.error(error?.message ?? "Couldn't save the pod."); }
    const location = {
      venue_address: f.format === "in_person" ? f.venue.trim() || null : null,
      video_link: f.format === "virtual" ? f.video.trim() || null : null,
      meeting_link: f.format === "virtual" ? f.meeting.trim() || null : null,
    };
    const { error: locErr } = await supabase.from("event_locations").upsert(data.map((r) => ({ event_id: r.id, ...location })));
    setSaving(false);
    if (locErr) return toast.error(locErr.message);
    await queryClient.invalidateQueries();
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    toast.success((isAdmin ? "Pod published" : "Pod sent for review") + " (3 sessions)");
    return navigate({ to: "/events/$eventId", params: { eventId: data[0]!.id } });
  }

  async function submit(e: React.FormEvent): Promise<unknown> {
    e.preventDefault();
    if (isPod) return submitPods();
    if (!f.title.trim() || !f.starts) return toast.error("Please add a title and a start time.");
    if (!f.photo_url) { setPhotoError(true); return toast.error("Please add a photo for your event."); }
    if (f.video && !/^https?:\/\//.test(f.video)) return toast.error("The video link should start with https://");
    if (f.format === "virtual" && f.meeting && !/^https?:\/\//.test(f.meeting)) return toast.error("The meeting link should start with https://");
    const starts_at = zonedInputToUtc(f.starts, f.timezone);
    const ends_at = f.ends ? zonedInputToUtc(f.ends, f.timezone) : null;
    if (ends_at && ends_at < starts_at) return toast.error("The end time must be after the start.");
    const capacity = f.capacity ? Number(f.capacity) : null;
    if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) return toast.error("Capacity must be a whole number above zero.");

    setSaving(true);
    const payload = {
      title: f.title.trim(),
      event_type: f.event_type,
      format: f.format,
      timezone: f.timezone,
      starts_at,
      ends_at,
      capacity,
      description: f.description.trim() || null,
      photo_url: f.photo_url,
    };
    const location = {
      venue_address: f.format === "in_person" ? f.venue.trim() || null : null,
      video_link: f.format === "virtual" ? f.video.trim() || null : null,
      meeting_link: f.format === "virtual" ? f.meeting.trim() || null : null,
    };
    let eventId = initial?.id;
    if (mode === "create") {
      if (repeat !== "none" && (!until || until < f.starts.slice(0, 10))) { setSaving(false); return toast.error("Please choose when the repeating ends."); }
      const durMs = ends_at ? new Date(ends_at).getTime() - new Date(starts_at).getTime() : null;
      const rows = occurrenceStarts(f.starts, repeat, until).map((local) => {
        const s = zonedInputToUtc(local, f.timezone);
        return {
          ...payload,
          starts_at: s,
          ends_at: durMs != null ? new Date(new Date(s).getTime() + durMs).toISOString() : null,
          created_by: userId,
          status: isAdmin ? "published" : "pending_approval",
        };
      });
      const { data, error } = await supabase.from("events").insert(rows).select("id,starts_at").order("starts_at");
      if (error || !data?.length) { setSaving(false); return toast.error(error?.message ?? "Couldn't save the event."); }
      const firstId = data[0]!.id;
      const { error: locErr } = await supabase.from("event_locations").upsert(data.map((r) => ({ event_id: r.id, ...location })));
      setSaving(false);
      if (locErr) return toast.error(locErr.message);
      await queryClient.invalidateQueries();
      const n = data.length > 1 ? ` (${data.length} dates)` : "";
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast.success((isAdmin ? "Event published" : "Proposal sent for review") + n);
      return navigate({ to: "/events/$eventId", params: { eventId: firstId } });
    } else {
      const { error } = await supabase.from("events").update(payload).eq("id", eventId!);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    const { error: locErr } = await supabase.from("event_locations").upsert({ event_id: eventId!, ...location });
    setSaving(false);
    if (locErr) return toast.error(locErr.message);
    await queryClient.invalidateQueries();
    toast.success("Event updated");
    return navigate({ to: "/events/$eventId", params: { eventId: eventId! } });
  }

  return (
    <form onSubmit={submit} className="mt-10 grid gap-6 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <div className="grid gap-3">
        <Label>Event photo (required)</Label>
        {preview ? <img src={preview} alt="" className="h-auto w-full rounded-2xl object-contain" /> : <div className="aspect-[16/9] w-full rounded-2xl bg-accent/60" />}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) { if (!x.type.startsWith("image/")) toast.error("Please choose an image."); else setCropFile(x); } e.target.value = ""; }} />
        <Button type="button" variant="outline" className="justify-self-start rounded-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : <Camera className="size-4 text-primary" strokeWidth={1.5} />}
          {f.photo_url ? "Change photo" : "Add a photo"}
        </Button>
        <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onDone={(file) => { setCropFile(null); void upload(file); }} />
        {photoError && !f.photo_url && <p className="text-sm text-destructive">Please add a photo for your event.</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={f.title} onChange={up("title")} maxLength={140} required />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="type">Type</Label>
          <select id="type" className={selectCls} value={f.event_type} onChange={up("event_type")}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="format">Format</Label>
          <select id="format" className={selectCls} value={f.format} onChange={up("format")}>
            {EVENT_FORMATS.map((t) => <option key={t} value={t}>{FORMAT_LABELS[t]}</option>)}
          </select>
        </div>
        {!isPod && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="starts">Starts</Label>
              <Input id="starts" type="datetime-local" value={f.starts} onChange={up("starts")} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ends">Ends</Label>
              <Input id="ends" type="datetime-local" value={f.ends} onChange={up("ends")} />
            </div>
          </>
        )}
        <div className="grid gap-2">
          <Label htmlFor="tz">Timezone</Label>
          <select id="tz" className={selectCls} value={f.timezone} onChange={(e) => setF((p) => ({ ...p, timezone: e.target.value }))}>
            {Array.from(new Set([f.timezone, ...listTimezones()])).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="capacity">Max amount of participants</Label>
          <Input id="capacity" type="number" min={1} value={f.capacity} onChange={up("capacity")} placeholder="Leave empty for unlimited" />
        </div>
      </div>
      {isPod && (
        <div className="grid gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Pod sessions</p>
          {pods.map((p, i) => (
            <div key={i} className="grid gap-4 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor={`pod-topic-${i}`}>Session {i + 1} topic</Label>
                <Input id={`pod-topic-${i}`} value={p.topic} onChange={upPod(i, "topic")} maxLength={80} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`pod-starts-${i}`}>Starts</Label>
                <Input id={`pod-starts-${i}`} type="datetime-local" value={p.starts} onChange={upPod(i, "starts")} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`pod-ends-${i}`}>Ends</Label>
                <Input id={`pod-ends-${i}`} type="datetime-local" value={p.ends} onChange={upPod(i, "ends")} />
              </div>
            </div>
          ))}
        </div>
      )}
      {mode === "create" && !isPod && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="repeat">Repeats</Label>
            <select id="repeat" className={selectCls} value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
              {(Object.keys(REPEAT_LABELS) as Repeat[]).map((r) => <option key={r} value={r}>{REPEAT_LABELS[r]}</option>)}
            </select>
          </div>
          {repeat !== "none" && (
            <div className="grid gap-2">
              <Label htmlFor="until">Repeat until</Label>
              <Input id="until" type="date" value={until} min={f.starts.slice(0, 10)} onChange={(e) => setUntil(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Each date becomes its own event, up to {MAX_OCCURRENCES} dates.</p>
            </div>
          )}
        </div>
      )}
      {f.format === "in_person" ? (
        <div className="grid gap-2">
          <Label htmlFor="venue">Venue address</Label>
          <Input id="venue" value={f.venue} onChange={up("venue")} />
          <p className="text-xs text-muted-foreground">Only shown to confirmed guests.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="meeting">Zoom/Google Meet/Riverside link</Label>
            <Input id="meeting" value={f.meeting} onChange={up("meeting")} placeholder="https://" />
            <p className="text-xs text-muted-foreground">Only shown to confirmed guests.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="video">Video link</Label>
            <Input id="video" value={f.video} onChange={up("video")} placeholder="https://" />
            <p className="text-xs text-muted-foreground">Only shown to confirmed guests.</p>
          </div>
        </>
      )}
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={6} value={f.description} onChange={up("description")} />
      </div>
      <Button type="submit" disabled={saving || uploading} className="justify-self-start rounded-full px-8">
        {saving ? "Saving…" : mode === "edit" ? "Save changes" : isAdmin ? "Publish event" : "Send for review"}
      </Button>
    </form>
  );
}
