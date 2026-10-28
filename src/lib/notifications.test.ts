import { describe, expect, it } from "vitest";
import { defaultPreferences, unreadBadge, notificationLink, type OkaNotification } from "./notifications";

describe("notifications rules", () => {
  it("defaults all five specified types to in-app and email enabled", () => {
    expect(defaultPreferences()).toEqual([
      { type: "event_reminder", in_app: true, email: true },
      { type: "event_changed", in_app: true, email: true },
      { type: "event_cancelled", in_app: true, email: true },
      { type: "profile_approved", in_app: true, email: true },
      { type: "referral_credit", in_app: true, email: true },
    ]);
  });
  it("counts only null read dates and caps the badge at 9+", () => {
    const rows: OkaNotification[] = Array.from({ length: 10 }, (_, index) => ({
      id: String(index), title: "Update", body: null, link: null, created_at: "2026-10-28T21:07:00Z", read_at: null,
    }));
    expect(unreadBadge(rows)).toBe("9+");
    expect(unreadBadge(rows.slice(0, 9))).toBe("9");
    expect(unreadBadge(rows.map((row) => ({ ...row, read_at: "2026-10-28T21:08:00Z" })))).toBeNull();
  });
  it("opens only safe same-app notification links", () => {
    expect(notificationLink("/events/123")).toBe("/events/123");
    expect(notificationLink("//external.example")).toBeNull();
    expect(notificationLink("/\\external.example")).toBeNull();
    expect(notificationLink("javascript:alert(1)")).toBeNull();
  });
});