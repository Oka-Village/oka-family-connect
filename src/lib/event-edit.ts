import type { EventRow } from "./events";

/** Presentation only: existing database policies still authorize writes. */
export function canEditEvent(
  event: Pick<EventRow, "host_id" | "created_by">,
  userId: string | null | undefined,
  isStaff: boolean,
): boolean {
  return Boolean(userId && (isStaff || event.created_by === userId || event.host_id === userId));
}

type EventDetails = Pick<EventRow, "title" | "event_type" | "format" | "timezone" | "starts_at" | "ends_at" | "capacity" | "description" | "photo_url" | "video_url">;

type ScheduleFields = { starts_at: string; ends_at: string | null; timezone: string };

function sameInstant(a: string | null, b: string | null) {
  if (!a || !b) return a === b;
  const left = new Date(a).getTime();
  const right = new Date(b).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) return a === b;
  return left === right;
}

/** Title, description, photo, and capacity edits are not a schedule change. */
export function scheduleChanged(before: ScheduleFields, after: ScheduleFields) {
  return !sameInstant(before.starts_at, after.starts_at)
    || !sameInstant(before.ends_at, after.ends_at)
    || before.timezone !== after.timezone;
}

/** Editing details must never publish a pending event or reset its approval. */
export function eventDetailsUpdate(details: EventDetails): EventDetails {
  return {
    title: details.title,
    event_type: details.event_type,
    format: details.format,
    timezone: details.timezone,
    starts_at: details.starts_at,
    ends_at: details.ends_at,
    capacity: details.capacity,
    description: details.description,
    photo_url: details.photo_url,
    video_url: details.video_url ?? null,
  };
}