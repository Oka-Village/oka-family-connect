// Compatibility entry for server-only callers. UI imports the client-safe
// *.functions.ts entry because src/server is excluded from the client graph.
export { listNotifications, markAllRead, getPreferences, setPreference, sendNotificationEmail } from "@/lib/notifications.functions";