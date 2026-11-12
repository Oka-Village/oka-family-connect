// How a member reaches the call once they're on an event page.
// Shared event links must always stop at the event page: the call only ever
// opens when the member clicks "Join room" themselves.
export type EventCallState = {
  /** Arrived on the event page from a shared /join/<slug> link. */
  via: "link" | undefined;
  /** The event uses Oka's built-in video room (vs. an external meeting link). */
  useRoom: boolean;
  /** The member is a confirmed guest, the host, or staff. */
  mayEnter: boolean;
  /** An externally hosted meeting link (Zoom, Google Meet, …) exists. */
  hasExternalLink: boolean;
};

/** A shared link never opens the call by itself — not even for a signed-in member. */
export function shouldAutoOpenCall(state: EventCallState): boolean {
  return false;
}

/** Which call control the event page shows. An external meeting link wins over the built-in room. */
export function eventCallAction(state: EventCallState): "external_link" | "room_button" | "locked" | "none" {
  if (state.hasExternalLink) return "external_link";
  if (!state.useRoom) return "none";
  return state.mayEnter ? "room_button" : "locked";
}
