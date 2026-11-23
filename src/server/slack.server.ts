export async function sendSlackEventAlert(text: string) {
  const url = process.env["SLACK_EVENTS_WEBHOOK_URL"];
  if (!url) return { ok: false as const, reason: "not_configured" as const };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return { ok: false as const, reason: "failed" as const, error: `Slack responded ${response.status}` };
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, reason: "failed" as const, error: error instanceof Error ? error.message : "Slack failed" };
  }
}
