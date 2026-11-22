import { runDueEventMail } from "@/server/event-mail.server";

export async function handleEventReminders() {
  try {
    const result = await runDueEventMail();
    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
