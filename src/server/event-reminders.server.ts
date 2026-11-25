import { runScheduledEventReminders } from "@/server/event-mail.server";

export async function handleEventReminders() {
  try {
    const result = await runScheduledEventReminders();
    return Response.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
