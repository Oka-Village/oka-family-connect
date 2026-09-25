import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

type Props = {
  mode: "create" | "edit";
  isAdmin: boolean;
  userId: string;
  initial?: EventRow;
  initialLocation?: { venue_address: string | null; video_link: string | null } | null;
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
    format: (initial?.format ?? "in_person") as EventFormat,
    timezone: tz0,
    starts: initial ? utcToZonedInput(initial.starts_at, tz0) : "",
    ends: initial?.ends_at ? utcToZonedInput(initial.ends_at, tz0) : "",
    capacity: initial?.capacity?.toString() ?? "",
    venue: initialLocation?.venue_address ?? "",
    video: initialLocation?.video_link ?? "",
    description: initial?.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !f.starts) return toast.error("Please add a title and a start time.");
    if (f.video && !/^https?:\/\//.test(f.video)) return toast.error("The video link should start with https://");
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
    };
    let eventId = initial?.id;
    if (mode === "create") {
      const { data, error } = await supabase
        .from("events")
        .insert({ ...payload, created_by: userId, status: isAdmin ? "published" : "pending_approval" })
        .select("id")
        .single();
      if (error) { setSaving(false); return toast.error(error.message); }
      eventId = data.id;
    } else {
      const { error } = await supabase.from("events").update(payload).eq("id", eventId!);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    const { error: locErr } = await supabase.from("event_locations").upsert({
      event_id: eventId!,
      venue_address: f.format === "in_person" ? f.venue.trim() || null : null,
      video_link: f.format === "virtual" ? f.video.trim() || null : null,
    });
    setSaving(false);
    if (locErr) return toast.error(locErr.message);
    await queryClient.invalidateQueries();
    toast.success(mode === "create" ? (isAdmin ? "Event published" : "Proposal sent for review") : "Event updated");
    navigate({ to: "/events/$eventId", params: { eventId: eventId! } });
  }

  return (
    <form onSubmit={submit} className="mt-10 grid gap-6 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
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
        <div className="grid gap-2">
          <Label htmlFor="starts">Starts</Label>
          <Input id="starts" type="datetime-local" value={f.starts} onChange={up("starts")} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ends">Ends</Label>
          <Input id="ends" type="datetime-local" value={f.ends} onChange={up("ends")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tz">Timezone</Label>
          <Input id="tz" list="tz-list" value={f.timezone} onChange={up("timezone")} />
          <datalist id="tz-list">
            {listTimezones().map((z) => <option key={z} value={z} />)}
          </datalist>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" type="number" min={1} value={f.capacity} onChange={up("capacity")} placeholder="Leave empty for unlimited" />
        </div>
      </div>
      {f.format === "in_person" ? (
        <div className="grid gap-2">
          <Label htmlFor="venue">Venue address</Label>
          <Input id="venue" value={f.venue} onChange={up("venue")} />
          <p className="text-xs text-muted-foreground">Only shown to confirmed guests.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="video">Video link</Label>
          <Input id="video" value={f.video} onChange={up("video")} placeholder="https://" />
          <p className="text-xs text-muted-foreground">Only shown to confirmed guests.</p>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={6} value={f.description} onChange={up("description")} />
      </div>
      <Button type="submit" disabled={saving} className="justify-self-start rounded-full px-8">
        {saving ? "Saving…" : mode === "edit" ? "Save changes" : isAdmin ? "Publish event" : "Send for review"}
      </Button>
    </form>
  );
}
