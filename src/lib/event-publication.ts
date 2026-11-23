export type PublicationEvent = { status: string; host_id: string | null; created_by: string | null };

/** Unpublished is reserved for previously approved events, never fresh drafts. */
export function canChangeEventStatus(event: PublicationEvent, userId: string, staff: boolean, next: string) {
  if (next === "unpublished") return staff && event.status === "published";
  if (staff) return ["published", "rejected", "cancelled"].includes(next);
  return next === "published" && event.status === "unpublished"
    && (event.host_id === userId || event.created_by === userId);
}

export function eventBelongsToMember(event: Pick<PublicationEvent, "host_id" | "created_by">, memberId: string) {
  return !memberId || event.host_id === memberId || event.created_by === memberId;
}