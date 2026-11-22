import { describe, expect, it } from "vitest";
import { canEditEvent, eventDetailsUpdate, scheduleChanged } from "./event-edit";

const event = {
  host_id: "facilitator", created_by: "creator", title: "Gathering",
  event_type: "gathering" as const, format: "virtual" as const,
  timezone: "Asia/Dhaka", starts_at: "2026-11-20T12:00:00Z",
  ends_at: null, capacity: null, description: null, photo_url: "cover.jpg",
};

describe("facilitator event editing", () => {
  it("saves and removes public videos without changing approval or ownership", () => {
    const update = eventDetailsUpdate({ ...event, video_url: "https://youtu.be/dQw4w9WgXcQ" });
    expect(update.video_url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(eventDetailsUpdate({ ...event, video_url: null }).video_url).toBeNull();
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("created_by");
  });
  it("lets the host edit pending events", () => {
    const pending = { ...event, status: "pending_approval" };
    expect(canEditEvent(pending, "facilitator", false)).toBe(true);
  });
  it("lets the creator edit approved events", () => {
    const approved = { ...event, status: "published" };
    expect(canEditEvent(approved, "creator", false)).toBe(true);
  });
  it("retains staff edit access", () => {
    expect(canEditEvent(event, "staff", true)).toBe(true);
  });
  it("denies unrelated members and signed-out visitors", () => {
    expect(canEditEvent(event, "other-member", false)).toBe(false);
    expect(canEditEvent(event, null, true)).toBe(false);
  });
  it("saves a changed date while keeping a pending proposal pending", () => {
    const pending = { ...event, status: "pending_approval" };
    const saved = { ...pending, ...eventDetailsUpdate({ ...pending, starts_at: "2026-11-22T12:00:00Z" }) };
    expect(saved.starts_at).toBe("2026-11-22T12:00:00Z");
    expect(saved.status).toBe("pending_approval");
  });
  it("saves an approved event without another approval or ownership changes", () => {
    const approved = { ...event, status: "published" };
    const update = eventDetailsUpdate({ ...approved, starts_at: "2026-11-23T12:00:00Z" });
    const saved = { ...approved, ...update };
    expect(saved.starts_at).toBe("2026-11-23T12:00:00Z");
    expect(saved.status).toBe("published");
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("host_id");
    expect(update).not.toHaveProperty("created_by");
  });
  it("treats a new start, end, or timezone as a schedule change and ignores title edits", () => {
    const before = { starts_at: "2026-11-20T12:00:00.000Z", ends_at: null, timezone: "Asia/Dhaka" };
    expect(scheduleChanged(before, { ...before, title: "Renamed" } as typeof before)).toBe(false);
    expect(scheduleChanged(before, { ...before, starts_at: "2026-11-20T12:00:00Z" })).toBe(false);
    expect(scheduleChanged(before, { ...before, starts_at: "2026-11-21T12:00:00.000Z" })).toBe(true);
    expect(scheduleChanged(before, { ...before, ends_at: "2026-11-20T13:00:00.000Z" })).toBe(true);
    expect(scheduleChanged(before, { ...before, timezone: "UTC" })).toBe(true);
  });
});