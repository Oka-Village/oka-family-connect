import { describe, expect, it } from "vitest";
import { renderNoticeHtml } from "../server/email.server";
import {
  KUMOJI,
  KUMOJI_JOY,
  approvedNotice,
  cancelTransition,
  dayReminderNotice,
  daysUntilEvent,
  deliveryKey,
  dueReminder,
  exceptionReminderNotice,
  exceptionTimezoneLines,
  exceptionWeekdayDate,
  firstNameFromDisplayName,
  hostRsvpNotice,
  noticeText,
  reconfirmTransition,
  reminderScheduleKey,
  rescheduleNotice,
  rescheduleScheduleKey,
  rsvpConfirmationNotice,
  submittedNotice,
  weekReminderNotice,
} from "./event-notifications";

const start = "2026-12-20T09:00:00.000Z";

describe("event notification copy", () => {
  it("uses Liran's sentences and kumoji only on member mail", () => {
    const review = submittedNotice({ title: "Morning sit", host: "Ada", when: "Sun, Dec 20, 9:00 AM GMT", category: "Meditation", reviewUrl: "https://www.oneworldfamily.app/events/1" });
    expect(review.paragraphs[0]).toBe("Event awaiting review: Morning sit, created by Ada, scheduled for Sun, Dec 20, 9:00 AM GMT.");
    expect(review.kumoji).toBe(false);
    expect(noticeText(review)).not.toContain(KUMOJI);
    expect(noticeText(review)).not.toContain(KUMOJI_JOY);

    const approved = approvedNotice({ title: "Morning sit", category: "Meditation", eventUrl: "https://www.oneworldfamily.app/events/1", shareUrl: "https://www.oneworldfamily.app/join/morning" });
    expect(approved.paragraphs[0]).toContain("has been approved and is now available");
    expect(approved.mood).toBe("joy");
    expect(noticeText(approved)).toContain(KUMOJI_JOY);
    expect(noticeText(approved)).toContain(KUMOJI);

    const rsvp = rsvpConfirmationNotice({ title: "Morning sit", host: "Ada", when: "Sun, Dec 20, 9:00 AM GMT", category: "Meditation", eventUrl: "https://www.oneworldfamily.app/events/1", meetingUrl: "https://meet.example/room" });
    expect(rsvp.paragraphs[0]).toBe("You're registered for Morning sit with Ada on Sun, Dec 20, 9:00 AM GMT. We look forward to sharing this experience with you.");
    expect(rsvp.links.map((link) => link.label)).toContain("Join live meeting");
    expect(rsvp.mood).toBe("joy");
    expect(noticeText(rsvp)).toContain(KUMOJI_JOY);

    expect(hostRsvpNotice({ name: "Noor", title: "Morning sit", count: 4, eventUrl: "https://www.oneworldfamily.app/events/1" }).mood).toBe("joy");
    expect(weekReminderNotice({ title: "Morning sit", category: "Meditation", eventUrl: "https://www.oneworldfamily.app/events/1" }).paragraphs[0])
      .toContain("Take a moment to save the time");
    expect(dayReminderNotice({ title: "Morning sit", when: "9:00 AM GMT", category: "Meditation", eventUrl: "https://www.oneworldfamily.app/events/1", meetingUrl: null }).paragraphs[0])
      .toContain("Your presence helps make this experience meaningful.");
    const moved = rescheduleNotice({ title: "Morning sit", previous: "Sun, Dec 20, 9:00 AM GMT", next: "Mon, Dec 21, 9:00 AM GMT", category: "Meditation", eventUrl: "https://www.oneworldfamily.app/events/1" });
    expect(moved.paragraphs[0]).toContain("confirm whether you can still join");
    expect(moved.mood).toBe("warm");
    expect(noticeText(moved)).toContain(KUMOJI);
    expect(noticeText(moved)).not.toContain(KUMOJI_JOY);
    expect(moved.paragraphs[1]).toContain("Previously:");
    expect(moved.paragraphs[2]).toContain("New time:");
  });

  it("renders a cream card with brand line and terracotta CTA buttons", () => {
    const html = renderNoticeHtml(rsvpConfirmationNotice({
      title: "Morning sit",
      host: "Ada",
      when: "Sun, Dec 20, 9:00 AM GMT",
      category: "Meditation",
      eventUrl: "https://www.oneworldfamily.app/events/1",
      meetingUrl: "https://meet.example/room",
    }));
    expect(html).toContain("OneWorld Family");
    expect(html).toContain("#FAF6EF");
    expect(html).toContain("#BB6A4D");
    expect(html).toContain("Join live meeting");
    expect(html).toContain(KUMOJI_JOY);
    expect(html).toContain(KUMOJI);
    expect(html).toContain("Made with care for our family");
  });
});

describe("exception reminder copy", () => {
  it("uses Liran's one-time wording with first name, countdown, and Cynara", () => {
    const notice = exceptionReminderNotice({
      firstName: "Elena",
      title: "Awakening Presence",
      eventUrl: "https://www.oneworldfamily.app/events/abc",
      daysLeft: 5,
      weekdayDate: "Sunday, Nov 29",
      timezoneLines: [
        "• Host time: 6:00 PM GMT+1",
        "• North America: 12:00 PM EST / 9:00 AM PST",
        "• Europe: 6:00 PM GMT+1 / 5:00 PM GMT",
        "• Asia: 10:30 PM GMT+5:30 / 12:00 AM GMT+6 (+1 day)",
      ],
    });
    expect(notice.subject).toBe("Reminder: Awakening Presence is coming up in 5 days");
    expect(notice.paragraphs[0]).toBe("Hi Elena,");
    expect(notice.paragraphs[1]).toContain("You've RSVP'd to the event: Awakening Presence");
    expect(notice.paragraphs[2]).toContain("coming up in 5 days");
    expect(notice.paragraphs[2]).toContain("At Sunday, Nov 29");
    expect(notice.paragraphs[3]).toContain("Time Zones:");
    expect(notice.paragraphs[4]).toContain("Cynara@okavillage.com");
    expect(notice.paragraphs[5]).toBe("Liran — One World Family");
    expect(notice.mood).toBe("warm");
    expect(noticeText(notice)).toContain(KUMOJI);
    expect(noticeText(notice)).not.toContain(KUMOJI_JOY);
    expect(notice.links[0]?.href).toBe("https://www.oneworldfamily.app/events/abc");
  });

  it("uses the singular day subject", () => {
    const notice = exceptionReminderNotice({
      firstName: "Ada",
      title: "Morning sit",
      eventUrl: "https://www.oneworldfamily.app/events/1",
      daysLeft: 1,
      weekdayDate: "Saturday, Dec 20",
      timezoneLines: ["• Host time: 9:00 AM UTC"],
    });
    expect(notice.subject).toBe("Reminder: Morning sit is coming up in 1 day");
  });

  it("parses the first name and counts whole days remaining", () => {
    expect(firstNameFromDisplayName("Elena Rivers")).toBe("Elena");
    expect(firstNameFromDisplayName("  ")).toBe("there");
    expect(firstNameFromDisplayName(null)).toBe("there");
    expect(daysUntilEvent("2026-12-20T09:00:00.000Z", new Date("2026-12-15T09:00:00.000Z"))).toBe(5);
    expect(daysUntilEvent("2026-12-20T09:00:00.000Z", new Date("2026-12-20T10:00:00.000Z"))).toBe(0);
  });

  it("formats weekday date and marks Asia when the calendar day advances", () => {
    // 20:00 UTC = 9:00 PM Paris; Kolkata/Dhaka are already on the next calendar day.
    expect(exceptionWeekdayDate("2026-11-29T20:00:00.000Z", "Europe/Paris")).toMatch(/Sunday/);
    const lines = exceptionTimezoneLines("2026-11-29T20:00:00.000Z", "Europe/Paris");
    expect(lines[0]).toMatch(/^• Host time:/);
    expect(lines[1]).toMatch(/^• North America:/);
    expect(lines[2]).toMatch(/^• Europe:/);
    expect(lines[3]).toMatch(/^• Asia:/);
    expect(lines[3]).toContain("(+1 day)");
  });
});

describe("reminder eligibility", () => {
  it("skips the seven-day note for someone who registered later, and skips anyone not going", () => {
    const now = new Date("2026-12-13T09:00:00.000Z");
    expect(dueReminder({ now, startsAt: start, eventStatus: "published", rsvpStatus: "going", rsvpCreatedAt: "2026-12-01T09:00:00.000Z" })).toBe("reminder_7d");
    expect(dueReminder({ now, startsAt: start, eventStatus: "published", rsvpStatus: "going", rsvpCreatedAt: "2026-12-14T09:00:00.000Z" })).toBeNull();
    expect(dueReminder({ now, startsAt: start, eventStatus: "published", rsvpStatus: "cancelled", rsvpCreatedAt: "2026-12-01T09:00:00.000Z" })).toBeNull();
    expect(dueReminder({ now, startsAt: start, eventStatus: "published", rsvpStatus: "awaiting_reconfirmation", rsvpCreatedAt: "2026-12-01T09:00:00.000Z" })).toBeNull();
    expect(dueReminder({ now, startsAt: start, eventStatus: "cancelled", rsvpStatus: "going", rsvpCreatedAt: "2026-12-01T09:00:00.000Z" })).toBeNull();
  });
  it("does not use the one-week subject once that moment is more than twelve hours late", () => {
    const now = new Date("2026-12-13T21:30:00.000Z");
    expect(dueReminder({ now, startsAt: start, eventStatus: "published", rsvpStatus: "going", rsvpCreatedAt: "2026-12-01T09:00:00.000Z" })).toBeNull();
  });
  it("sends the day-before note inside its twelve-hour window", () => {
    const now = new Date("2026-12-19T12:00:00.000Z");
    expect(dueReminder({ now, startsAt: start, eventStatus: "published", rsvpStatus: "going", rsvpCreatedAt: "2026-12-18T09:00:00.000Z" })).toBe("reminder_24h");
  });
});

describe("delivery identity", () => {
  it("keeps one confirmation for a repeated RSVP and allows a new reminder after the start changes", () => {
    const first = deliveryKey({ templateKey: "rsvp_confirmation", channel: "email", recipientKey: "member", eventId: "event", scheduleKey: reminderScheduleKey(start) });
    expect(first).toBe(deliveryKey({ templateKey: "rsvp_confirmation", channel: "email", recipientKey: "member", eventId: "event", scheduleKey: reminderScheduleKey("2026-12-20T09:00:00Z") }));
    const reminder = deliveryKey({ templateKey: "reminder_7d", channel: "email", recipientKey: "member", eventId: "event", scheduleKey: reminderScheduleKey(start) });
    const moved = deliveryKey({ templateKey: "reminder_7d", channel: "email", recipientKey: "member", eventId: "event", scheduleKey: reminderScheduleKey("2026-12-22T09:00:00.000Z") });
    expect(reminder).not.toBe(moved);
  });
  it("gives a timezone-only change its own reschedule key", () => {
    const base = { starts_at: start, ends_at: null, timezone: "UTC" };
    expect(rescheduleScheduleKey(base)).not.toBe(rescheduleScheduleKey({ ...base, timezone: "Asia/Dhaka" }));
    expect(rescheduleScheduleKey(base)).toBe(rescheduleScheduleKey({ ...base, starts_at: "2026-12-20T09:00:00Z" }));
  });
});

describe("RSVP seat rules", () => {
  it("returns an awaiting member to going without a new seat or a new registration time", () => {
    expect(reconfirmTransition("awaiting_reconfirmation")).toEqual({ next: "going", bumpGoing: false, resetCreatedAt: false });
    expect(reconfirmTransition("going")).toEqual({ next: "going", bumpGoing: false, resetCreatedAt: false });
  });
  it("releases the held seat when an awaiting member cancels", () => {
    expect(cancelTransition("awaiting_reconfirmation")).toEqual({ releaseGoing: true, releaseWaitlist: false });
    expect(cancelTransition("going")).toEqual({ releaseGoing: true, releaseWaitlist: false });
    expect(cancelTransition("waitlist")).toEqual({ releaseGoing: false, releaseWaitlist: true });
    expect(cancelTransition("cancelled")).toEqual({ releaseGoing: false, releaseWaitlist: false });
  });
});
