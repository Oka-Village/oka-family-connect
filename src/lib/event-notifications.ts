import { formatEventTimeDual } from "./event-time";

export const KUMOJI = "╰(´︶`)╯♡";
export const KUMOJI_JOY = "(๑˃̵ᴗ˂̵)";
export const TEMPLATE_VERSION = 2;
export const EXCEPTION_SCHEDULE_KEY = "exception:once";
export const REMINDER_EXCEPTION_TEMPLATE = "reminder_exception";

export const EVENT_CATEGORY_LABELS = {
  gathering: "Gathering",
  workshop: "Workshop",
  pod_session: "Pod session",
  meditation: "Meditation",
  retreat: "Retreat",
} as const;

export type EventCategory = keyof typeof EVENT_CATEGORY_LABELS;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
export const REMINDER_LATE_WINDOW = 12 * HOUR;
export const MISSED_CONFIRMATION_WINDOW = 2 * HOUR;

export type EventNotice = {
  subject: string;
  paragraphs: string[];
  links: { label: string; href: string }[];
  kumoji: boolean;
  /** Joy adds the excited mark before the affectionate signature. */
  mood?: "warm" | "joy";
};

export type ScheduleStamp = { starts_at: string; ends_at: string | null; timezone: string };

export function categoryLabel(eventType: string) {
  return EVENT_CATEGORY_LABELS[eventType as EventCategory] ?? "Gathering";
}

/** Event time in the recipient's own timezone, labelled "(Your time)". Falls back to host time. */
export function formatEventWhenFor(startsAt: string, endsAt: string | null, hostZone: string | null, viewerZone: string | null) {
  if (!viewerZone) return `${formatEventWhen(startsAt, endsAt, hostZone)} (host time${hostZone ? ` · ${hostZone}` : ""})`;
  return `${formatEventWhen(startsAt, endsAt, viewerZone)} (Your time)`;
}

export function formatEventWhen(startsAt: string, endsAt: string | null, timezone: string | null) {
  const zone = timezone || "UTC";
  const when = formatEventTimeDual(startsAt, endsAt, zone, null);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(startsAt));
  return `${date}, ${when.primary}`;
}

export function deliveryKey(input: { templateKey: string; channel: string; recipientKey: string; eventId: string; scheduleKey: string }) {
  return [input.templateKey, input.channel, input.recipientKey, input.eventId, input.scheduleKey].join("\u0000");
}

export function reminderScheduleKey(startsAt: string) {
  return new Date(startsAt).toISOString();
}

export function rescheduleScheduleKey(next: ScheduleStamp) {
  const start = new Date(next.starts_at).toISOString();
  const end = next.ends_at ? new Date(next.ends_at).toISOString() : "";
  return `${start}|${end}|${next.timezone}`;
}

export function submittedNotice(input: { title: string; host: string; when: string; category: string; reviewUrl: string }): EventNotice {
  return {
    subject: `Event awaiting review: ${input.title}`,
    paragraphs: [
      `Event awaiting review: ${input.title}, created by ${input.host}, scheduled for ${input.when}.`,
      `Activity: ${input.category}.`,
    ],
    links: [{ label: "Open the review", href: input.reviewUrl }],
    kumoji: false,
  };
}

export function approvedNotice(input: { title: string; category: string; eventUrl: string; shareUrl: string }): EventNotice {
  return {
    subject: `Your event is now available`,
    paragraphs: [
      `Your event, ${input.title}, has been approved and is now available. Thank you for sharing your gifts with the family.`,
      `Activity: ${input.category}.`,
    ],
    links: [
      { label: "View your event", href: input.eventUrl },
      { label: "Your invitation link", href: input.shareUrl },
    ],
    kumoji: true,
    mood: "joy",
  };
}

export function rejectedNotice(input: { title: string; category: string }): EventNotice {
  return {
    subject: `About your event, ${input.title}`,
    paragraphs: [
      `Your event, ${input.title}, was not approved. Thank you for offering it to the family.`,
      `Activity: ${input.category}.`,
    ],
    links: [],
    kumoji: true,
    mood: "warm",
  };
}

export function rsvpConfirmationNotice(input: { title: string; host: string; when: string; category: string; eventUrl: string; meetingUrl: string | null }): EventNotice {
  return {
    subject: `You're registered for ${input.title}`,
    paragraphs: [
      `You're registered for ${input.title} with ${input.host} on ${input.when}. We look forward to sharing this experience with you.`,
      `Activity: ${input.category}.`,
    ],
    links: [
      { label: "View the event", href: input.eventUrl },
      ...(input.meetingUrl ? [{ label: "Join live meeting", href: input.meetingUrl }] : []),
    ],
    kumoji: true,
    mood: "joy",
  };
}

export function hostRsvpNotice(input: { name: string; title: string; count: number; eventUrl: string }): EventNotice {
  const participants = input.count === 1 ? "registered participant" : "registered participants";
  return {
    subject: `${input.name} has joined ${input.title}`,
    paragraphs: [`${input.name} has joined ${input.title}. You now have ${input.count} ${participants}.`],
    links: [{ label: "View your event", href: input.eventUrl }],
    kumoji: true,
    mood: "joy",
  };
}

export function weekReminderNotice(input: { title: string; category: string; eventUrl: string }): EventNotice {
  return {
    subject: `One week until ${input.title}`,
    paragraphs: [
      `One week until ${input.title}. Take a moment to save the time and prepare a comfortable space for yourself.`,
      `Activity: ${input.category}.`,
    ],
    links: [{ label: "View the event", href: input.eventUrl }],
    kumoji: true,
    mood: "joy",
  };
}

export function dayReminderNotice(input: { title: string; when: string; category: string; eventUrl: string; meetingUrl: string | null }): EventNotice {
  return {
    subject: `We're gathering tomorrow for ${input.title}`,
    paragraphs: [
      `We're gathering tomorrow for ${input.title} at ${input.when}. Your presence helps make this experience meaningful.`,
      `Activity: ${input.category}.`,
    ],
    links: [
      { label: "View the event", href: input.eventUrl },
      ...(input.meetingUrl ? [{ label: "Join live meeting", href: input.meetingUrl }] : []),
    ],
    kumoji: true,
    mood: "joy",
  };
}

export function rescheduleNotice(input: { title: string; previous: string; next: string; category: string; eventUrl: string }): EventNotice {
  return {
    subject: `The time for ${input.title} has changed`,
    paragraphs: [
      `The time for ${input.title} has changed. Please check the new schedule and confirm whether you can still join.`,
      `Previously: ${input.previous}.`,
      `New time: ${input.next}.`,
      `Activity: ${input.category}.`,
    ],
    links: [{ label: "Confirm whether you can still join", href: input.eventUrl }],
    kumoji: true,
    mood: "warm",
  };
}

export function cancelledNotice(input: { title: string; category: string; forCreator: boolean }): EventNotice {
  return {
    subject: `${input.title} has been cancelled`,
    paragraphs: [
      input.forCreator
        ? `${input.title} has been cancelled. Everyone who had registered has been told.`
        : `${input.title} has been cancelled. You don't need to keep this time.`,
      `Activity: ${input.category}.`,
    ],
    links: [],
    kumoji: true,
    mood: "warm",
  };
}

export function firstNameFromDisplayName(displayName: string | null | undefined) {
  const token = displayName?.trim().split(/\s+/)[0];
  return token || "there";
}

/** Whole days remaining until start (ceil); never negative while the event is still upcoming. */
export function daysUntilEvent(startsAt: string, now: Date = new Date()) {
  const start = new Date(startsAt).getTime();
  const current = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(current)) return 0;
  if (start <= current) return 0;
  return Math.max(0, Math.ceil((start - current) / DAY));
}

export function exceptionWeekdayDate(startsAt: string, hostTimezone: string | null | undefined) {
  const zone = hostTimezone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date(startsAt));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date(startsAt));
  }
}

function zoneDateKey(iso: string, zone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function zoneTimeShort(iso: string, zone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  }
}

function zoneLine(iso: string, zone: string, hostZone: string) {
  const time = zoneTimeShort(iso, zone);
  const hostKey = zoneDateKey(iso, hostZone);
  const zoneKey = zoneDateKey(iso, zone);
  return zoneKey > hostKey ? `${time} (+1 day)` : time;
}

/** Host + fixed North America / Europe / Asia lines for the one-time exception reminder. */
export function exceptionTimezoneLines(startsAt: string, hostTimezone: string | null | undefined) {
  let hostZone = "UTC";
  try {
    hostZone = new Intl.DateTimeFormat("en-US", { timeZone: hostTimezone || "UTC" }).resolvedOptions().timeZone;
  } catch {
    hostZone = "UTC";
  }
  return [
    `• Host time: ${zoneTimeShort(startsAt, hostZone)}`,
    `• North America: ${zoneLine(startsAt, "America/New_York", hostZone)} / ${zoneLine(startsAt, "America/Los_Angeles", hostZone)}`,
    `• Europe: ${zoneLine(startsAt, "Europe/Paris", hostZone)} / ${zoneLine(startsAt, "Europe/London", hostZone)}`,
    `• Asia: ${zoneLine(startsAt, "Asia/Kolkata", hostZone)} / ${zoneLine(startsAt, "Asia/Dhaka", hostZone)}`,
  ];
}

export function exceptionReminderNotice(input: {
  firstName: string;
  title: string;
  eventUrl: string;
  daysLeft: number;
  weekdayDate: string;
  timezoneLines: string[];
}): EventNotice {
  const daysPhrase = input.daysLeft === 1 ? "1 day" : `${input.daysLeft} days`;
  return {
    subject: `Reminder: ${input.title} is coming up in ${daysPhrase}`,
    paragraphs: [
      `Hi ${input.firstName},`,
      `You've RSVP'd to the event: ${input.title}`,
      `I'd like to remind you that it's coming up in ${daysPhrase}.\nAt ${input.weekdayDate}`,
      `Time Zones:\n${input.timezoneLines.join("\n")}`,
      "Click again on the link and log into your profile to share it with others you may like to join. If you have any questions please write to Cynara at Cynara@okavillage.com.\nLet us know if you have any questions.",
      "Liran — One World Family",
    ],
    links: [{ label: "Open the event", href: input.eventUrl }],
    kumoji: true,
    mood: "warm",
  };
}

export function noticeText(notice: EventNotice) {
  const lines = [...notice.paragraphs];
  for (const link of notice.links) lines.push(`${link.label}: ${link.href}`);
  if (notice.kumoji && notice.mood === "joy") lines.push(KUMOJI_JOY);
  if (notice.kumoji) lines.push(KUMOJI);
  return lines.join("\n\n");
}

function due(now: number, moment: number) {
  return moment <= now && now - moment <= REMINDER_LATE_WINDOW;
}

/** Which reminder, if any, should send for this attendee at this moment. */
export function dueReminder(input: {
  now: Date;
  startsAt: string;
  eventStatus: string;
  rsvpStatus: string;
  rsvpCreatedAt: string;
}): "reminder_7d" | "reminder_24h" | null {
  if (input.eventStatus !== "published" || input.rsvpStatus !== "going") return null;
  const start = new Date(input.startsAt).getTime();
  const created = new Date(input.rsvpCreatedAt).getTime();
  const now = input.now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(created) || start <= now) return null;
  if (due(now, start - DAY)) return "reminder_24h";
  const registeredEarlyEnough = created <= start - 7 * DAY;
  if (registeredEarlyEnough && due(now, start - 7 * DAY)) return "reminder_7d";
  return null;
}

export function missedConfirmation(input: { now: Date; statusChangedAt: string; rsvpStatus: string }) {
  if (input.rsvpStatus !== "going") return false;
  const changed = new Date(input.statusChangedAt).getTime();
  const now = input.now.getTime();
  return Number.isFinite(changed) && changed <= now && now - changed <= MISSED_CONFIRMATION_WINDOW;
}

/** Reconfirming keeps the seat and the original registration time. */
export function reconfirmTransition(status: string) {
  if (status === "going" || status === "waitlist") return { next: status, bumpGoing: false, resetCreatedAt: false };
  if (status === "awaiting_reconfirmation") return { next: "going", bumpGoing: false, resetCreatedAt: false };
  return null;
}

/** Cancelling an awaiting member releases the seat they still hold. */
export function cancelTransition(status: string) {
  if (status === "going" || status === "awaiting_reconfirmation") return { releaseGoing: true, releaseWaitlist: false };
  if (status === "waitlist") return { releaseGoing: false, releaseWaitlist: true };
  return { releaseGoing: false, releaseWaitlist: false };
}
