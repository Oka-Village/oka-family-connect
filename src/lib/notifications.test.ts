import { describe, expect, it } from "vitest";
import {
  channelAlwaysOn,
  channelUnavailable,
  defaultPreferences,
  enforceLockedPreference,
  notificationDisplayBody,
  notificationPresentation,
  unreadBadge,
  notificationLink,
  type OkaNotification,
} from "./notifications";

describe("notifications rules", () => {
  it("defaults all five specified types with locked channels enforced", () => {
    expect(defaultPreferences()).toEqual([
      { type: "event_reminder", in_app: false, email: true },
      { type: "event_changed", in_app: true, email: true },
      { type: "event_cancelled", in_app: true, email: true },
      { type: "profile_approved", in_app: true, email: true },
      { type: "referral_credit", in_app: true, email: true },
    ]);
  });
  it("keeps schedule-change in-app and email locked on, and reminder in-app off", () => {
    expect(enforceLockedPreference({ type: "event_changed", in_app: false, email: false })).toEqual({
      type: "event_changed", in_app: true, email: true,
    });
    expect(enforceLockedPreference({ type: "event_cancelled", in_app: false, email: false })).toEqual({
      type: "event_cancelled", in_app: false, email: true,
    });
    expect(enforceLockedPreference({ type: "event_reminder", in_app: true, email: false })).toEqual({
      type: "event_reminder", in_app: false, email: false,
    });
    expect(channelAlwaysOn("event_changed", "in_app")).toBe(true);
    expect(channelAlwaysOn("event_changed", "email")).toBe(true);
    expect(channelUnavailable("event_reminder", "in_app")).toBe(true);
    expect(channelUnavailable("event_changed", "in_app")).toBe(false);
  });
  it("counts only null read dates and caps the badge at 9+", () => {
    const rows: OkaNotification[] = Array.from({ length: 10 }, (_, index) => ({
      id: String(index), type: "event_rescheduled", title: "Update", body: null, link: null, created_at: "2026-10-28T21:07:00Z", read_at: null,
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
  it("trims kumoji and raw link lines from the card body", () => {
    expect(notificationDisplayBody([
      "The time for Morning sit has changed. Please check the new schedule and confirm whether you can still join.",
      "Previously: Sun, Dec 20, 9:00 AM GMT.",
      "Confirm whether you can still join: https://www.oneworldfamily.app/events/1",
      "(๑˃̵ᴗ˂̵)",
      "╰(´︶`)╯♡",
    ].join("\n\n"))).toBe([
      "The time for Morning sit has changed. Please check the new schedule and confirm whether you can still join.",
      "Previously: Sun, Dec 20, 9:00 AM GMT.",
    ].join("\n\n"));
    expect(notificationDisplayBody(null)).toBeNull();
  });
  it("maps delivery template keys to icon presentation", () => {
    expect(notificationPresentation("event_rescheduled", "/events/1")).toEqual({
      icon: "reschedule", tone: "warm", ctaLabel: "View event",
    });
    expect(notificationPresentation("event_cancelled", "/events/1")).toEqual({
      icon: "cancelled", tone: "muted", ctaLabel: "View event",
    });
    expect(notificationPresentation("event_approved", "/profile")).toEqual({
      icon: "approved", tone: "success", ctaLabel: "View update",
    });
    expect(notificationPresentation("unknown", null)).toEqual({
      icon: "default", tone: "primary", ctaLabel: "View update",
    });
  });
});