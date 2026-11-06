import { describe, expect, it } from "vitest";
import { isMissingInviteFunction, pickInviteCard, shouldReserveSpot, type InviteCardEvent } from "./event-invite";

const gathering = (overrides: Partial<InviteCardEvent> = {}): InviteCardEvent => ({
  id: "event-1",
  title: "Inauguration",
  starts_at: "2026-12-01T18:00:00.000Z",
  ends_at: "2026-12-01T19:00:00.000Z",
  timezone: "UTC",
  status: "published",
  ...overrides,
});

describe("shouldReserveSpot", () => {
  it("reserves a spot for a guest who is not already going or waitlisted", () => {
    expect(shouldReserveSpot(false, false, null)).toBe(true);
    expect(shouldReserveSpot(false, false, "cancelled")).toBe(true);
  });
  it("leaves an existing reservation and a host alone", () => {
    expect(shouldReserveSpot(false, false, "going")).toBe(false);
    expect(shouldReserveSpot(false, false, "waitlist")).toBe(false);
    expect(shouldReserveSpot(true, false, null)).toBe(false);
    expect(shouldReserveSpot(false, true, null)).toBe(false);
  });
});

describe("isMissingInviteFunction", () => {
  it("recognizes a database that has not installed the invite function", () => {
    expect(isMissingInviteFunction({ code: "PGRST202", message: "Could not find the function public.remember_event_invite" })).toBe(true);
    expect(isMissingInviteFunction({ code: "42883", message: "function public.remember_event_invite(text) does not exist" })).toBe(true);
    expect(isMissingInviteFunction({ message: "Could not find the function remember_event_invite in the schema cache" })).toBe(true);
  });
  it("leaves real failures on the invite path", () => {
    expect(isMissingInviteFunction({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingInviteFunction(null)).toBe(false);
    expect(isMissingInviteFunction({ message: "Not signed in" })).toBe(false);
  });
});

describe("pickInviteCard", () => {
  const now = Date.parse("2026-11-06T00:00:00.000Z");

  it("picks the latest published gathering that has not ended", () => {
    const older = gathering({ id: "older", title: "Older" });
    const newer = gathering({ id: "newer", title: "Newer" });
    expect(pickInviteCard(
      [
        { event_id: "older", created_at: "2026-11-01T00:00:00.000Z" },
        { event_id: "newer", created_at: "2026-11-05T00:00:00.000Z" },
      ],
      [older, newer],
      now,
    )?.id).toBe("newer");
  });
  it("skips a past, cancelled, or missing event and keeps a later upcoming one", () => {
    const past = gathering({ id: "past", ends_at: "2026-11-01T00:00:00.000Z" });
    const cancelled = gathering({ id: "cancelled", status: "cancelled" });
    const upcoming = gathering({ id: "upcoming", title: "Still ahead" });
    expect(pickInviteCard(
      [
        { event_id: "upcoming", created_at: "2026-11-02T00:00:00.000Z" },
        { event_id: "missing", created_at: "2026-11-04T00:00:00.000Z" },
        { event_id: "cancelled", created_at: "2026-11-05T00:00:00.000Z" },
        { event_id: "past", created_at: "2026-11-06T00:00:00.000Z" },
      ],
      [past, cancelled, upcoming],
      now,
    )?.title).toBe("Still ahead");
  });
  it("returns nothing when every visit is over", () => {
    expect(pickInviteCard(
      [{ event_id: "past", created_at: "2026-11-01T00:00:00.000Z" }],
      [gathering({ id: "past", ends_at: "2026-10-01T00:00:00.000Z" })],
      now,
    )).toBeNull();
  });
});
