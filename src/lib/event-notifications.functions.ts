import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { canEditEvent, eventDetailsUpdate } from "@/lib/event-edit";
import { EVENT_FORMATS, EVENT_TYPES } from "@/lib/events";

async function callerIsStaff(supabase: SupabaseClient<Database>, userId: string) {
  const [admin, moderator] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
  ]);
  return admin.data === true || moderator.data === true;
}

const eventIdSchema = z.object({ eventId: z.string().uuid() });

export const notifyEventCreated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { dispatchEventCreated } = await import("@/server/event-mail.server");
    return dispatchEventCreated({ eventId: data.eventId, userId: context.userId });
  });

export const notifyEventStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    eventId: z.string().uuid(),
    status: z.enum(["published", "rejected", "cancelled"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await callerIsStaff(context.supabase, context.userId))) throw new Error("Staff access required");
    const { data: updated, error } = await context.supabase.from("events").update({ status: data.status }).eq("id", data.eventId).select("id").maybeSingle();
    if (error || !updated) throw new Error(error?.message ?? "Couldn't update this event.");
    const { dispatchEventStatus } = await import("@/server/event-mail.server");
    return dispatchEventStatus({ eventId: data.eventId, status: data.status });
  });

export const notifyRsvpConfirmed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => eventIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { dispatchRsvpConfirmed } = await import("@/server/event-mail.server");
    return dispatchRsvpConfirmed({ eventId: data.eventId, userId: context.userId });
  });

const detailsSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  event_type: z.enum(EVENT_TYPES),
  format: z.enum(EVENT_FORMATS),
  timezone: z.string().min(1),
  starts_at: z.string().min(1),
  ends_at: z.string().nullable(),
  capacity: z.number().int().positive().nullable(),
  description: z.string().nullable(),
  photo_url: z.string().nullable(),
  video_url: z.string().nullable(),
});

export const saveEventDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => detailsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: current, error } = await context.supabase.from("events")
      .select("id,title,event_type,format,timezone,starts_at,ends_at,capacity,description,photo_url,video_url,host_id,created_by,status")
      .eq("id", data.eventId).maybeSingle();
    if (error || !current) throw new Error(error?.message ?? "This event isn't available.");
    const staff = await callerIsStaff(context.supabase, context.userId);
    if (!canEditEvent(current, context.userId, staff)) throw new Error("You don't have permission to edit this gathering.");
    const update = eventDetailsUpdate({
      title: data.title,
      event_type: data.event_type,
      format: data.format,
      timezone: data.timezone,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      capacity: data.capacity,
      description: data.description,
      photo_url: data.photo_url,
      video_url: data.video_url,
    });
    const { data: saved, error: saveError } = await context.supabase.from("events").update(update).eq("id", data.eventId).select("id,status").maybeSingle();
    if (saveError || !saved) throw new Error(saveError?.message ?? "Couldn't save the event.");
    const { dispatchScheduleChange, } = await import("@/server/event-mail.server");
    const { data: fresh } = await context.supabase.from("events")
      .select("id,title,event_type,status,starts_at,ends_at,timezone,host_id,created_by,join_slug,description,format")
      .eq("id", data.eventId).maybeSingle();
    if (fresh) {
      await dispatchScheduleChange({
        event: { ...fresh, timezone: fresh.timezone ?? "UTC" },
        previous: { starts_at: current.starts_at, ends_at: current.ends_at, timezone: current.timezone ?? "UTC" },
      });
    }
    return { status: saved.status };
  });

const deliverySelect = "id,template_key,template_version,channel,recipient_address,recipient_key,event_id,schedule_key,timezone,scheduled_for,sent_at,status,error,attempt_count,payload,created_at";

export const listEventDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await callerIsStaff(context.supabase, context.userId))) return { deliveries: [] as DeliveryList[] };
    const client = context.supabase as unknown as SupabaseClient;
    const { data, error } = await client.from("notification_deliveries").select(deliverySelect).order("created_at", { ascending: false }).limit(40);
    if (error) return { deliveries: [] as DeliveryList[] };
    return { deliveries: (data ?? []) as DeliveryList[] };
  });

export const previewEventDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deliveryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await callerIsStaff(context.supabase, context.userId))) throw new Error("Staff access required");
    const client = context.supabase as unknown as SupabaseClient;
    const { data: row, error } = await client.from("notification_deliveries").select("payload,template_key,template_version,status").eq("id", data.deliveryId).maybeSingle();
    if (error || !row) throw new Error("That delivery isn't available.");
    const payload = (row as { payload?: { subject?: string; text?: string } | null }).payload;
    return { subject: payload?.subject ?? "", text: payload?.text ?? "", templateKey: (row as { template_key: string }).template_key, templateVersion: (row as { template_version: number }).template_version };
  });

export const retryEventDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deliveryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await callerIsStaff(context.supabase, context.userId))) throw new Error("Staff access required");
    const { retryDelivery } = await import("@/server/event-mail.server");
    return retryDelivery(data.deliveryId);
  });

export const testSendEventDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deliveryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await callerIsStaff(context.supabase, context.userId))) throw new Error("Staff access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = user.user?.email;
    if (error || !email) throw new Error("Your account has no email address for a test send.");
    const { sendDeliveryPreviewTo } = await import("@/server/event-mail.server");
    return sendDeliveryPreviewTo({ deliveryId: data.deliveryId, to: email, recipientKey: context.userId });
  });

export type DeliveryList = {
  id: string;
  template_key: string;
  template_version: number;
  channel: string;
  recipient_address: string | null;
  recipient_key: string;
  event_id: string;
  schedule_key: string;
  timezone: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  status: string;
  error: string | null;
  attempt_count: number;
  created_at: string;
};
