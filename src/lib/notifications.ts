import { z } from "zod";

export const NOTIFICATION_TYPES = ["event_reminder", "event_changed", "event_cancelled", "profile_approved", "referral_credit"] as const;
export const preferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  in_app: z.boolean(),
  email: z.boolean(),
});
export type NotificationPreference = z.infer<typeof preferenceSchema>;
export const notificationSchema = z.object({
  id: z.string(), title: z.string(), body: z.string().nullable(),
  created_at: z.string(), read_at: z.string().nullable(), link: z.string().nullable(),
});
export type OkaNotification = z.infer<typeof notificationSchema>;

export function defaultPreferences(): NotificationPreference[] {
  return NOTIFICATION_TYPES.map((type) => ({ type, in_app: true, email: true }));
}

export function unreadBadge(notifications: OkaNotification[]): string | null {
  const count = notifications.filter((notification) => notification.read_at === null).length;
  return count === 0 ? null : count > 9 ? "9+" : String(count);
}

/** Only same-app links can be opened from a notification. */
export function notificationLink(link: string | null): string | null {
  return link?.startsWith("/") && !link.startsWith("//") && !/[\\\u0000-\u0020]/.test(link) ? link : null;
}