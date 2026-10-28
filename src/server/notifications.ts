// Compatibility entry for server-only callers. UI imports the client-safe
// *.functions.ts entry because src/server is excluded from the client graph.
import { createServerOnlyFn } from "@tanstack/react-start";

export { listNotifications, markAllRead, getPreferences, setPreference } from "@/lib/notifications.functions";

/** Intentionally inert even when configured; never calls an email provider. */
export const sendNotificationEmail = createServerOnlyFn(async (_to: string, _subject: string, _text: string) => {
  try {
    if (!process.env['RESEND_API_KEY']) return { skipped: true as const };
    return { skipped: true as const };
  } catch {
    return { skipped: true as const };
  }
});