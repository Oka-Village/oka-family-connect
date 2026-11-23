import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PRODUCTION_ORIGIN } from "@/lib/affiliate-share";
import { calendarInviteIcs, type CalendarEvent } from "@/lib/calendar";
import { scheduleChanged } from "@/lib/event-edit";
import {
  KUMOJI,
  KUMOJI_JOY,
  TEMPLATE_VERSION,
  approvedNotice,
  cancelledNotice,
  categoryLabel,
  dayReminderNotice,
  dueReminder,
  formatEventWhen,
  hostRsvpNotice,
  missedConfirmation,
  noticeText,
  rejectedNotice,
  reminderScheduleKey,
  rescheduleNotice,
  rescheduleScheduleKey,
  rsvpConfirmationNotice,
  submittedNotice,
  weekReminderNotice,
  type EventNotice,
  type ScheduleStamp,
} from "@/lib/event-notifications";
import { joinUrl } from "@/lib/join-link";
import { sendResendEmail, resendConfigured } from "@/server/email.server";
import { sendSlackEventAlert } from "@/server/slack.server";

type DbError = { code?: string; message?: string } | null;
type Channel = "email" | "in_app" | "slack";

type StoredMail = {
  subject: string;
  text: string;
  html: string;
  attachment?: { filename: string; content: string; contentType?: string | undefined } | null;
};

type DeliveryRow = {
  id: string;
  template_key: string;
  channel: Channel;
  recipient_key: string;
  recipient_address: string | null;
  status: string;
  attempt_count: number;
  payload: StoredMail | null;
  event_id: string;
};

type EventRecord = {
  id: string;
  title: string;
  event_type: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  host_id: string | null;
  created_by: string | null;
  join_slug: string;
  description: string | null;
  format: string;
};

function db() {
  return supabaseAdmin as unknown as SupabaseClient;
}

function missing(error: DbError) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

function eventUrl(id: string) {
  return `${PRODUCTION_ORIGIN}/events/${id}`;
}

async function displayName(userId: string | null) {
  if (!userId) return "A family member";
  const { data } = await db().from("profiles").select("display_name").eq("id", userId).maybeSingle();
  const name = (data as { display_name?: string | null } | null)?.display_name?.trim();
  return name || "A family member";
}

async function memberEmail(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) return null;
  return data.user?.email ?? null;
}

async function staffRecipientsForReview(): Promise<{ userId: string; email: string }[]> {
  const { data, error } = await db().from("user_roles").select("user_id").in("role", ["admin", "moderator"]);
  if (error || !data) return [];
  const ids = [...new Set(data.map((row) => row.user_id as string).filter(Boolean))];
  const out: { userId: string; email: string }[] = [];
  for (const userId of ids) {
    const email = await memberEmail(userId);
    if (email) out.push({ userId, email });
  }
  return out;
}

async function loadEvent(eventId: string): Promise<EventRecord | null> {
  const { data, error } = await db().from("events")
    .select("id,title,event_type,status,starts_at,ends_at,timezone,host_id,created_by,join_slug,description,format")
    .eq("id", eventId).maybeSingle();
  if (error || !data) return null;
  return data as EventRecord;
}

async function meetingLink(eventId: string) {
  const { data } = await db().from("event_locations").select("meeting_link,venue_address").eq("event_id", eventId).maybeSingle();
  const row = data as { meeting_link?: string | null; venue_address?: string | null } | null;
  return { meeting: row?.meeting_link?.trim() || null, venue: row?.venue_address?.trim() || null };
}

async function shareUrl(event: EventRecord) {
  const hostId = event.host_id ?? event.created_by;
  if (!hostId) return joinUrl(event.join_slug);
  const { data } = await db().from("affiliates").select("invite_code").eq("user_id", hostId).eq("status", "active").maybeSingle();
  const code = (data as { invite_code?: string } | null)?.invite_code;
  return joinUrl(event.join_slug, code);
}

async function goingCount(eventId: string) {
  const { count } = await db().from("event_rsvps").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "going");
  return count ?? 0;
}

async function emailPreferenceOn(userId: string, type: "event_reminder") {
  const { data, error } = await db().from("notification_preferences").select("email").eq("user_id", userId).eq("type", type).maybeSingle();
  if (error || !data) return true;
  return (data as { email?: boolean }).email !== false;
}

async function inAppPreferenceOn(userId: string, type: "event_cancelled") {
  const { data, error } = await db().from("notification_preferences").select("in_app").eq("user_id", userId).eq("type", type).maybeSingle();
  if (error || !data) return true;
  return (data as { in_app?: boolean }).in_app !== false;
}

async function inviteSequence(eventId: string) {
  const { count } = await db().from("notification_deliveries").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("template_key", "event_rescheduled").eq("channel", "email").eq("status", "sent");
  return count ?? 0;
}

function icsFor(event: EventRecord, method: "REQUEST" | "CANCEL", sequence: number, location: string | null) {
  const calendar: CalendarEvent = {
    id: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    description: event.description,
    url: eventUrl(event.id),
    location,
  };
  return {
    filename: method === "CANCEL" ? "cancel.ics" : "invite.ics",
    content: calendarInviteIcs(calendar, { method, sequence }),
    contentType: `text/calendar; charset=utf-8; method=${method}`,
  };
}

async function claimAndFinish(row: DeliveryRow, send: () => Promise<{ ok: boolean; reason?: "not_configured" | "failed" | undefined; error?: string | undefined }>) {
  if (row.status === "sent" || row.status === "cancelled") return { ok: true as const, skipped: true as const };
  if (row.status === "failed" && row.attempt_count >= 3) return { ok: true as const, skipped: true as const };
  if (row.channel === "email" && !row.recipient_address) {
    await db().from("notification_deliveries").update({ status: "not_configured", error: "No recipient address" }).eq("id", row.id);
    return { ok: false as const, skipped: true as const };
  }
  if (!resendConfigured() && row.channel === "email") {
    await db().from("notification_deliveries").update({ status: "not_configured", error: "Resend is not configured" }).eq("id", row.id);
    return { ok: false as const, skipped: true as const };
  }
  if (row.channel === "slack" && !process.env["SLACK_EVENTS_WEBHOOK_URL"]) {
    await db().from("notification_deliveries").update({ status: "not_configured", error: "Slack is not configured" }).eq("id", row.id);
    return { ok: false as const, skipped: true as const };
  }
  const nextAttempt = row.attempt_count + 1;
  const { data: claimed } = await db().from("notification_deliveries")
    .update({ attempt_count: nextAttempt, status: "pending", error: null })
    .eq("id", row.id)
    .eq("attempt_count", row.attempt_count)
    .in("status", ["pending", "failed", "not_configured"])
    .lt("attempt_count", 3)
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: true as const, skipped: true as const };
  const result = await send();
  if (result.ok) {
    await db().from("notification_deliveries").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", row.id);
    return { ok: true as const, skipped: false as const };
  }
  if (result.reason === "not_configured") {
    await db().from("notification_deliveries").update({ status: "not_configured", attempt_count: row.attempt_count, error: result.error ?? "Not configured" }).eq("id", row.id);
    return { ok: false as const, skipped: true as const };
  }
  await db().from("notification_deliveries").update({ status: "failed", error: result.error ?? "Delivery failed" }).eq("id", row.id);
  return { ok: false as const, skipped: false as const };
}

async function deliver(input: {
  templateKey: string;
  channel: Channel;
  recipientUserId: string | null;
  recipientAddress: string | null;
  recipientKey: string;
  eventId: string;
  scheduleKey: string;
  timezone: string | null;
  scheduledFor: string | null;
  notice: EventNotice;
  attachment?: { filename: string; content: string; contentType?: string | undefined } | null | undefined;
}) {
  const payload: StoredMail = {
    subject: input.notice.subject,
    text: noticeText(input.notice),
    html: "",
    attachment: input.attachment ?? null,
  };
  const insert = await db().from("notification_deliveries").insert({
    template_key: input.templateKey,
    template_version: TEMPLATE_VERSION,
    channel: input.channel,
    recipient_user_id: input.recipientUserId,
    recipient_address: input.recipientAddress,
    recipient_key: input.recipientKey,
    event_id: input.eventId,
    schedule_key: input.scheduleKey,
    timezone: input.timezone,
    scheduled_for: input.scheduledFor,
    status: "pending",
    payload,
  }).select("id,template_key,channel,recipient_key,recipient_address,status,attempt_count,payload,event_id").maybeSingle();
  if (missing(insert.error)) return { ok: false as const, skipped: true as const };
  let row = insert.data as DeliveryRow | null;
  if (!row && insert.error && (insert.error as DbError)?.code === "23505") {
    const existing = await db().from("notification_deliveries").select("id,template_key,channel,recipient_key,recipient_address,status,attempt_count,payload,event_id")
      .eq("template_key", input.templateKey).eq("channel", input.channel).eq("recipient_key", input.recipientKey)
      .eq("event_id", input.eventId).eq("schedule_key", input.scheduleKey).maybeSingle();
    row = existing.data as DeliveryRow | null;
  } else if (insert.error) {
    return { ok: false as const, skipped: true as const };
  }
  if (!row) return { ok: false as const, skipped: true as const };
  if (row.status === "sent" || row.status === "cancelled") return { ok: true as const, skipped: true as const };
  const address = input.recipientAddress ?? row.recipient_address;
  return claimAndFinish({ ...row, payload }, async () => {
    if (input.channel === "slack") {
      const slack = await sendSlackEventAlert(payload.text);
      return slack.ok ? { ok: true } : { ok: false, reason: slack.reason, error: slack.reason === "failed" ? slack.error : undefined };
    }
    if (input.channel === "in_app") {
      if (!input.recipientUserId) return { ok: false, reason: "failed", error: "No member for this bell" };
      const note = await db().from("notifications").insert({
        user_id: input.recipientUserId,
        type: input.templateKey,
        title: input.notice.subject,
        body: payload.text,
        link: `/events/${input.eventId}`,
      });
      if (note.error) return { ok: false, reason: missing(note.error) ? "not_configured" : "failed", error: note.error.message };
      return { ok: true };
    }
    if (!address) return { ok: false, reason: "failed", error: "No email address" };
    const sent = await sendResendEmail({ to: address, notice: input.notice, attachment: input.attachment });
    return sent.ok ? { ok: true } : { ok: false, reason: sent.reason, error: sent.reason === "failed" ? sent.error : undefined };
  });
}

function whenOf(event: EventRecord) {
  return formatEventWhen(event.starts_at, event.ends_at, event.timezone);
}

export async function dispatchEventCreated(input: { eventId: string; userId: string }) {
  const event = await loadEvent(input.eventId);
  if (!event || event.created_by !== input.userId || event.event_type === "pod_session") return { ok: true as const, skipped: true as const };
  if (event.status === "published") return sendApproved(event);
  if (event.status !== "pending_approval") return { ok: true as const, skipped: true as const };
  const host = await displayName(event.host_id ?? event.created_by);
  const when = whenOf(event);
  const notice = submittedNotice({ title: event.title, host, when, category: categoryLabel(event.event_type), reviewUrl: eventUrl(event.id) });
  const staff = await staffRecipientsForReview();
  let email: Awaited<ReturnType<typeof deliver>> = { ok: true as const, skipped: true as const };
  if (staff.length) {
    for (const { userId, email: address } of staff) {
      email = await deliver({
        templateKey: "event_submitted", channel: "email", recipientUserId: userId, recipientAddress: address, recipientKey: userId,
        eventId: event.id, scheduleKey: "once", timezone: event.timezone, scheduledFor: null, notice,
      });
    }
  } else {
    const admin = process.env["ADMIN_NOTIFICATION_EMAIL"];
    email = await deliver({
      templateKey: "event_submitted", channel: "email", recipientUserId: null, recipientAddress: admin ?? null, recipientKey: admin ?? "admin",
      eventId: event.id, scheduleKey: "once", timezone: event.timezone, scheduledFor: null, notice,
    });
  }
  await deliver({
    templateKey: "event_submitted", channel: "slack", recipientUserId: null, recipientAddress: null, recipientKey: "slack",
    eventId: event.id, scheduleKey: "once", timezone: event.timezone, scheduledFor: null, notice,
  });
  return email;
}

async function sendApproved(event: EventRecord) {
  const creator = event.created_by;
  if (!creator) return { ok: true as const, skipped: true as const };
  const email = await memberEmail(creator);
  const notice = approvedNotice({
    title: event.title,
    category: categoryLabel(event.event_type),
    eventUrl: eventUrl(event.id),
    shareUrl: await shareUrl(event),
  });
  return deliver({
    templateKey: "event_approved", channel: "email", recipientUserId: creator, recipientAddress: email, recipientKey: creator,
    eventId: event.id, scheduleKey: "once", timezone: event.timezone, scheduledFor: null, notice,
  });
}

export async function dispatchEventStatus(input: { eventId: string; status: "published" | "rejected" | "cancelled" }) {
  const event = await loadEvent(input.eventId);
  if (!event || event.status !== input.status || event.event_type === "pod_session") return { ok: true as const, skipped: true as const };
  if (input.status === "published") return sendApproved(event);
  const creator = event.created_by;
  if (input.status === "rejected") {
    if (!creator) return { ok: true as const, skipped: true as const };
    return deliver({
      templateKey: "event_rejected", channel: "email", recipientUserId: creator, recipientAddress: await memberEmail(creator), recipientKey: creator,
      eventId: event.id, scheduleKey: "once", timezone: event.timezone, scheduledFor: null,
      notice: rejectedNotice({ title: event.title, category: categoryLabel(event.event_type) }),
    });
  }
  await db().from("notification_deliveries").update({ status: "cancelled", error: "Event cancelled" })
    .eq("event_id", event.id).in("template_key", ["reminder_7d", "reminder_24h"]).in("status", ["pending", "failed", "not_configured"]);
  const sequence = await inviteSequence(event.id);
  const place = await meetingLink(event.id);
  const attachment = icsFor(event, "CANCEL", sequence, place.meeting || place.venue);
  if (creator) {
    await deliver({
      templateKey: "event_cancelled", channel: "email", recipientUserId: creator, recipientAddress: await memberEmail(creator), recipientKey: `creator:${creator}`,
      eventId: event.id, scheduleKey: "once", timezone: event.timezone, scheduledFor: null,
      notice: cancelledNotice({ title: event.title, category: categoryLabel(event.event_type), forCreator: true }),
    });
  }
  const { data } = await db().from("event_rsvps").select("user_id").eq("event_id", event.id).in("status", ["going", "awaiting_reconfirmation"]);
  for (const row of (data ?? []) as { user_id: string }[]) {
    const allowed = await inAppPreferenceOn(row.user_id, "event_cancelled");
    const notice = cancelledNotice({ title: event.title, category: categoryLabel(event.event_type), forCreator: false });
    await deliver({
      templateKey: "event_cancelled", channel: "email", recipientUserId: row.user_id, recipientAddress: await memberEmail(row.user_id), recipientKey: row.user_id,
      eventId: event.id, scheduleKey: "once", timezone: event.timezone, scheduledFor: null, notice, attachment,
    });
    if (allowed) {
      await deliver({
        templateKey: "event_cancelled", channel: "in_app", recipientUserId: row.user_id, recipientAddress: null, recipientKey: row.user_id,
        eventId: event.id, scheduleKey: "once", timezone: event.timezone, scheduledFor: null, notice,
      });
    }
  }
  return { ok: true as const, skipped: false as const };
}

export async function dispatchRsvpConfirmed(input: { eventId: string; userId: string }) {
  const event = await loadEvent(input.eventId);
  if (!event || event.status !== "published" || event.event_type === "pod_session") return { ok: true as const, skipped: true as const };
  const { data: rsvp } = await db().from("event_rsvps").select("status").eq("event_id", event.id).eq("user_id", input.userId).maybeSingle();
  if ((rsvp as { status?: string } | null)?.status !== "going") return { ok: true as const, skipped: true as const };
  const place = await meetingLink(event.id);
  const sequence = await inviteSequence(event.id);
  const when = whenOf(event);
  const host = await displayName(event.host_id ?? event.created_by);
  const guest = await displayName(input.userId);
  await deliver({
    templateKey: "rsvp_confirmation", channel: "email", recipientUserId: input.userId, recipientAddress: await memberEmail(input.userId), recipientKey: input.userId,
    eventId: event.id, scheduleKey: reminderScheduleKey(event.starts_at), timezone: event.timezone, scheduledFor: null,
    notice: rsvpConfirmationNotice({
      title: event.title, host, when, category: categoryLabel(event.event_type), eventUrl: eventUrl(event.id), meetingUrl: place.meeting,
    }),
    attachment: icsFor(event, "REQUEST", sequence, place.meeting || place.venue),
  });
  const hostId = event.host_id ?? event.created_by;
  if (hostId && hostId !== input.userId) {
    await deliver({
      templateKey: "host_rsvp", channel: "email", recipientUserId: hostId, recipientAddress: await memberEmail(hostId), recipientKey: `${hostId}:${input.userId}`,
      eventId: event.id, scheduleKey: reminderScheduleKey(event.starts_at), timezone: event.timezone, scheduledFor: null,
      notice: hostRsvpNotice({ name: guest, title: event.title, count: await goingCount(event.id), eventUrl: eventUrl(event.id) }),
    });
  }
  return { ok: true as const, skipped: false as const };
}

export async function dispatchScheduleChange(input: { event: EventRecord; previous: ScheduleStamp }) {
  if (input.event.status !== "published" || input.event.event_type === "pod_session") return;
  if (!scheduleChanged(input.previous, input.event)) return;
  const { data: guests } = await db().from("event_rsvps").select("user_id").eq("event_id", input.event.id).eq("status", "going");
  const ids = ((guests ?? []) as { user_id: string }[]).map((guest) => guest.user_id);
  await db().rpc("mark_event_rsvps_awaiting_reconfirmation", { _event_id: input.event.id });
  await db().from("notification_deliveries").update({ status: "cancelled", error: "Schedule changed" })
    .eq("event_id", input.event.id).in("template_key", ["reminder_7d", "reminder_24h"]).in("status", ["pending", "failed", "not_configured"]);
  const previous = formatEventWhen(input.previous.starts_at, input.previous.ends_at, input.previous.timezone);
  const next = whenOf(input.event);
  const notice = rescheduleNotice({
    title: input.event.title, previous, next, category: categoryLabel(input.event.event_type), eventUrl: eventUrl(input.event.id),
  });
  const scheduleKey = rescheduleScheduleKey(input.event);
  for (const userId of ids) {
    await deliver({
      templateKey: "event_rescheduled", channel: "email", recipientUserId: userId, recipientAddress: await memberEmail(userId), recipientKey: userId,
      eventId: input.event.id, scheduleKey, timezone: input.event.timezone, scheduledFor: null, notice,
    });
    // Schedule edits always bell — preference cannot drop the in-app channel.
    await deliver({
      templateKey: "event_rescheduled", channel: "in_app", recipientUserId: userId, recipientAddress: null, recipientKey: userId,
      eventId: input.event.id, scheduleKey, timezone: input.event.timezone, scheduledFor: null, notice,
    });
  }
}

async function sendReminder(event: EventRecord, userId: string, kind: "reminder_7d" | "reminder_24h") {
  if (!(await emailPreferenceOn(userId, "event_reminder"))) return;
  const place = await meetingLink(event.id);
  const when = whenOf(event);
  const notice = kind === "reminder_7d"
    ? weekReminderNotice({ title: event.title, category: categoryLabel(event.event_type), eventUrl: eventUrl(event.id) })
    : dayReminderNotice({ title: event.title, when, category: categoryLabel(event.event_type), eventUrl: eventUrl(event.id), meetingUrl: place.meeting });
  const start = new Date(event.starts_at).getTime();
  const scheduledFor = new Date(start - (kind === "reminder_7d" ? 7 : 1) * 24 * 60 * 60 * 1000).toISOString();
  await deliver({
    templateKey: kind, channel: "email", recipientUserId: userId, recipientAddress: await memberEmail(userId), recipientKey: userId,
    eventId: event.id, scheduleKey: reminderScheduleKey(event.starts_at), timezone: event.timezone, scheduledFor, notice,
  });
}

export async function runDueEventMail(now = new Date()) {
  const soonest = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const latest = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error } = await db().from("events")
    .select("id,title,event_type,status,starts_at,ends_at,timezone,host_id,created_by,join_slug,description,format")
    .eq("status", "published").neq("event_type", "pod_session").gte("starts_at", soonest).lte("starts_at", latest).limit(200);
  if (missing(error)) return { ok: false as const, skipped: true as const };
  for (const event of (events ?? []) as EventRecord[]) {
    const { data: rsvps } = await db().from("event_rsvps").select("user_id,status,created_at").eq("event_id", event.id).eq("status", "going");
    for (const rsvp of (rsvps ?? []) as { user_id: string; status: string; created_at: string }[]) {
      const kind = dueReminder({ now, startsAt: event.starts_at, eventStatus: event.status, rsvpStatus: rsvp.status, rsvpCreatedAt: rsvp.created_at });
      if (kind) await sendReminder(event, rsvp.user_id, kind);
    }
  }
  const since = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await db().from("event_rsvps").select("event_id,user_id,status,status_changed_at")
    .eq("status", "going").gte("status_changed_at", since).limit(200);
  for (const rsvp of (recent ?? []) as { event_id: string; user_id: string; status: string; status_changed_at: string }[]) {
    if (!missedConfirmation({ now, statusChangedAt: rsvp.status_changed_at, rsvpStatus: rsvp.status })) continue;
    await dispatchRsvpConfirmed({ eventId: rsvp.event_id, userId: rsvp.user_id });
  }
  const { data: retryable } = await db().from("notification_deliveries")
    .select("id,template_key,channel,recipient_key,recipient_address,status,attempt_count,payload,event_id")
    .in("status", ["failed", "not_configured"]).lt("attempt_count", 3).limit(40);
  for (const row of (retryable ?? []) as DeliveryRow[]) await retryDelivery(row.id);
  return { ok: true as const, skipped: false as const };
}

export async function retryDelivery(id: string) {
  const { data } = await db().from("notification_deliveries")
    .select("id,template_key,channel,recipient_key,recipient_address,status,attempt_count,payload,event_id")
    .eq("id", id).maybeSingle();
  const row = data as DeliveryRow | null;
  if (!row || !row.payload?.text) return { ok: false as const, skipped: true as const };
  if (["reminder_7d", "reminder_24h"].includes(row.template_key)) {
    const event = await loadEvent(row.event_id);
    if (!event || event.status !== "published") return { ok: true as const, skipped: true as const };
  }
  const notice: EventNotice = {
    subject: row.payload.subject,
    paragraphs: row.payload.text.split("\n\n").filter((line) => !line.startsWith("http") && line !== KUMOJI && line !== KUMOJI_JOY),
    links: [],
    kumoji: row.payload.text.includes(KUMOJI),
    mood: row.payload.text.includes(KUMOJI_JOY) ? "joy" : "warm",
  };
  return claimAndFinish(row, async () => {
    if (row.channel === "slack") {
      const slack = await sendSlackEventAlert(row.payload?.text ?? "");
      return slack.ok ? { ok: true } : { ok: false, reason: slack.reason, error: slack.reason === "failed" ? slack.error : undefined };
    }
    if (row.channel === "in_app") {
      const note = await db().from("notifications").insert({
        user_id: row.recipient_key, type: row.template_key, title: notice.subject, body: row.payload?.text, link: `/events/${row.event_id}`,
      });
      if (note.error) return { ok: false, reason: "failed" as const, error: note.error.message };
      return { ok: true };
    }
    if (!row.recipient_address) return { ok: false, reason: "failed" as const, error: "No email address" };
    const sent = await sendResendEmail({
      to: row.recipient_address,
      notice,
      attachment: row.payload?.attachment,
    });
    return sent.ok ? { ok: true } : { ok: false, reason: sent.reason, error: sent.reason === "failed" ? sent.error : undefined };
  });
}

export async function sendDeliveryPreviewTo(input: { deliveryId: string; to: string; recipientKey: string }) {
  const { data } = await db().from("notification_deliveries")
    .select("id,template_key,channel,recipient_key,recipient_address,status,attempt_count,payload,event_id")
    .eq("id", input.deliveryId).maybeSingle();
  const row = data as DeliveryRow | null;
  if (!row?.payload?.subject) return { ok: false as const, skipped: true as const };
  const notice: EventNotice = {
    subject: `[Test] ${row.payload.subject}`,
    paragraphs: row.payload.text.split("\n\n").filter((line) => line !== KUMOJI && line !== KUMOJI_JOY),
    links: [],
    kumoji: row.payload.text.includes(KUMOJI),
    mood: row.payload.text.includes(KUMOJI_JOY) ? "joy" : "warm",
  };
  return deliver({
    templateKey: `${row.template_key}:test`,
    channel: "email",
    recipientUserId: null,
    recipientAddress: input.to,
    recipientKey: input.recipientKey,
    eventId: row.event_id,
    scheduleKey: `test:${new Date().toISOString()}`,
    timezone: null,
    scheduledFor: null,
    notice,
    attachment: row.payload.attachment,
  });
}

