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