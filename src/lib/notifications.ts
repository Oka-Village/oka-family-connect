import { z } from "zod";

export const NOTIFICATION_TYPES = ["event_reminder", "event_changed", "event_cancelled", "profile_approved", "referral_credit"] as const;
export const preferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  in_app: z.boolean(),
  email: z.boolean(),
});
export type NotificationPreference = z.infer<typeof preferenceSchema>;
export const notificationSchema = z.object({
  id: z.string(),
  type: z.string().nullable().optional(),
  title: z.string(),
  body: z.string().nullable(),
  created_at: z.string(),
  read_at: z.string().nullable(),
  link: z.string().nullable(),
});
export type OkaNotification = z.infer<typeof notificationSchema>;

export type NotificationIconKind = "reschedule" | "cancelled" | "approved" | "reminder" | "default";
export type NotificationTone = "warm" | "muted" | "success" | "primary";

export type NotificationPresentation = {
  icon: NotificationIconKind;
  tone: NotificationTone;
  ctaLabel: "View event" | "View update";
};

const KUMOJI_LINE = /^╰\(´︶`\)╯♡$/;
const KUMOJI_JOY_LINE = /^\(๑˃̵ᴗ˂̵\)$/;
const LINK_LINE = /^.+:\s*https?:\/\/\S+$/i;

/** Email always sent for schedule changes and cancellations. */
export const ALWAYS_EMAIL = new Set<NotificationPreference["type"]>(["event_changed", "event_cancelled"]);
/** In-app always sent for schedule changes — members must see the bell. */
export const ALWAYS_IN_APP = new Set<NotificationPreference["type"]>(["event_changed"]);
/** Reminders are email-only; no in-app channel is wired. */
export const NO_IN_APP = new Set<NotificationPreference["type"]>(["event_reminder"]);

export function defaultPreferences(): NotificationPreference[] {
  return NOTIFICATION_TYPES.map((type) => enforceLockedPreference({ type, in_app: true, email: true }));
}

/** Force locked channels so clients and upserts cannot turn them off (or on for unused in-app). */
export function enforceLockedPreference(preference: NotificationPreference): NotificationPreference {
  return {
    ...preference,
    email: ALWAYS_EMAIL.has(preference.type) ? true : preference.email,
    in_app: ALWAYS_IN_APP.has(preference.type) ? true : NO_IN_APP.has(preference.type) ? false : preference.in_app,
  };
}

export function channelAlwaysOn(type: NotificationPreference["type"], channel: "in_app" | "email") {
  if (channel === "email") return ALWAYS_EMAIL.has(type);
  return ALWAYS_IN_APP.has(type);
}

export function channelUnavailable(type: NotificationPreference["type"], channel: "in_app" | "email") {
  return channel === "in_app" && NO_IN_APP.has(type);
}

export function unreadBadge(notifications: OkaNotification[]): string | null {
  const count = notifications.filter((notification) => notification.read_at === null).length;
  return count === 0 ? null : count > 9 ? "9+" : String(count);
}

/** Only same-app links can be opened from a notification. */
export function notificationLink(link: string | null): string | null {
  return link?.startsWith("/") && !link.startsWith("//") && !/[\\\u0000-\u0020]/.test(link) ? link : null;
}

/** Card body only — keeps human paragraphs; drops kumoji and raw link lines. */
export function notificationDisplayBody(body: string | null | undefined): string | null {
  if (!body) return null;
  const paragraphs = body
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !KUMOJI_LINE.test(part) && !KUMOJI_JOY_LINE.test(part) && !LINK_LINE.test(part));
  return paragraphs.length ? paragraphs.join("\n\n") : null;
}

/** Map stored delivery template keys to icon/tone/CTA for the bell UI. */
export function notificationPresentation(type: string | null | undefined, link: string | null | undefined): NotificationPresentation {
  const safe = notificationLink(link ?? null);
  const ctaLabel = safe?.startsWith("/events/") ? "View event" : "View update";
  switch (type) {
    case "event_rescheduled":
      return { icon: "reschedule", tone: "warm", ctaLabel };
    case "event_cancelled":
      return { icon: "cancelled", tone: "muted", ctaLabel };
    case "event_approved":
    case "profile_approved":
      return { icon: "approved", tone: "success", ctaLabel };
    case "reminder_7d":
    case "reminder_24h":
    case "event_reminder":
      return { icon: "reminder", tone: "primary", ctaLabel };
    default:
      return { icon: "default", tone: "primary", ctaLabel };
  }
}