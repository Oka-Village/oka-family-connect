import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  events: [] as Record<string, unknown>[],
  rsvps: [] as Record<string, unknown>[],
  deliveries: [] as Record<string, unknown>[],
  configured: true,
  emailOn: true,
  send: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/server/email.server", () => ({
  resendConfigured: () => fixture.configured,
  sendResendEmail: fixture.send,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "reminder-test@example.com" } }, error: null }) } },
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      let action = "select";
      let changes: Record<string, unknown> = {};
      let lower = 0;
      let upper = 99;
      const result = () => {
        let rows = table === "events" ? fixture.events : table === "event_rsvps" ? fixture.rsvps
          : table === "notification_deliveries" ? fixture.deliveries : [];
        rows = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
        if (action === "insert") {
          const existing = fixture.deliveries.find((row) => ["event_id", "template_key", "channel", "recipient_key", "schedule_key"]
            .every((key) => row[key] === changes[key]));
          const row = existing ?? { id: `delivery-${fixture.deliveries.length}`, attempt_count: 0, ...changes };
          if (!existing) fixture.deliveries.push(row);
          rows = [row];
        } else if (action === "update") {
          rows.forEach((row) => Object.assign(row, changes));
        }
        if (table === "profiles") rows = [{ timezone: "Asia/Dhaka" }];
        if (table === "notification_preferences") rows = [{ email: fixture.emailOn }];
        return { data: rows.slice(lower, upper + 1), error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        in: () => query, gte: () => query, lte: () => query, lt: () => query,
        order: () => query,
        range: (start: number, end: number) => { lower = start; upper = end; return query; },
        insert: (row: Record<string, unknown>) => { action = "insert"; changes = row; return query; },
        update: (row: Record<string, unknown>) => { action = "update"; changes = row; return query; },
        maybeSingle: async () => { const response = result(); return { ...response, data: response.data[0] ?? null }; },
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  },
}));

import { runScheduledEventReminders } from "./event-mail.server";

beforeEach(() => {
  fixture.events = [{ id: "event", title: "Morning gathering", event_type: "gathering", status: "published",
    starts_at: "2026-12-20T09:00:00.000Z", ends_at: "2026-12-20T10:00:00.000Z", timezone: "UTC" }];
  fixture.rsvps = [{ event_id: "event", user_id: "member", status: "going", created_at: "2026-12-01T09:00:00.000Z" }];
  fixture.deliveries = [];
  fixture.configured = true;
  fixture.emailOn = true;
  fixture.send.mockReset();
  fixture.send.mockResolvedValue({ ok: true });
});

describe("automatic RSVP reminder dispatch", () => {
  it("sends seven days before and skips a second run for the same member and schedule", async () => {
    const now = new Date("2026-12-13T09:00:00.000Z");
    await runScheduledEventReminders(now);
    await runScheduledEventReminders(now);
    expect(fixture.send).toHaveBeenCalledTimes(1);
    expect(fixture.deliveries[0]?.["template_key"]).toBe("reminder_7d");
    expect(fixture.deliveries[0]?.["status"]).toBe("sent");
    expect(fixture.deliveries[0]?.["timezone"]).toBe("Asia/Dhaka");
    expect(fixture.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "event-reminder/delivery-0" }));
  });

  it("sends the separate 24-hour reminder after the seven-day reminder", async () => {
    await runScheduledEventReminders(new Date("2026-12-13T09:00:00.000Z"));
    await runScheduledEventReminders(new Date("2026-12-19T09:00:00.000Z"));
    expect(fixture.send).toHaveBeenCalledTimes(2);
    expect(fixture.deliveries.map((row) => row["template_key"])).toEqual(["reminder_7d", "reminder_24h"]);
  });

  it("respects a member's disabled email preference", async () => {
    fixture.emailOn = false;
    await runScheduledEventReminders(new Date("2026-12-13T09:00:00.000Z"));
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it("retries a failed reminder using the same provider identity on the next scheduled run", async () => {
    fixture.send.mockResolvedValueOnce({ ok: false });
    await runScheduledEventReminders(new Date("2026-12-19T09:00:00.000Z"));
    expect(fixture.deliveries[0]?.["status"]).toBe("failed");
    await runScheduledEventReminders(new Date("2026-12-19T09:30:00.000Z"));
    expect(fixture.deliveries).toHaveLength(1);
    expect(fixture.deliveries[0]?.["status"]).toBe("sent");
    expect(fixture.send).toHaveBeenNthCalledWith(2, expect.objectContaining({ idempotencyKey: "event-reminder/delivery-0" }));
  });

  it("does not send to cancelled RSVPs or for unpublished events", async () => {
    const rsvp = fixture.rsvps[0];
    if (rsvp) rsvp["status"] = "cancelled";
    await runScheduledEventReminders(new Date("2026-12-13T09:00:00.000Z"));
    expect(fixture.send).not.toHaveBeenCalled();
    const event = fixture.events[0];
    if (event) event["status"] = "unpublished";
    if (rsvp) rsvp["status"] = "going";
    await runScheduledEventReminders(new Date("2026-12-13T09:00:00.000Z"));
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it("reports unavailable email configuration without delivering", async () => {
    fixture.configured = false;
    expect(await runScheduledEventReminders()).toEqual({ ok: false, processed: 0 });
    expect(fixture.send).not.toHaveBeenCalled();
  });
});