import { describe, expect, it } from "vitest";
import { eventCallAction, shouldAutoOpenCall, type EventCallState } from "./event-call-entry";

const LINKED: EventCallState = {
  via: "link",
  useRoom: true,
  mayEnter: true,
  hasExternalLink: false,
};

describe("shouldAutoOpenCall", () => {
  it("never opens the built-in room automatically for a member arriving from a shared link", () => {
    expect(shouldAutoOpenCall(LINKED)).toBe(false);
  });

  it("never opens the room automatically in any other state either", () => {
    expect(shouldAutoOpenCall({ via: undefined, useRoom: true, mayEnter: true, hasExternalLink: false })).toBe(false);
    expect(shouldAutoOpenCall({ via: "link", useRoom: false, mayEnter: true, hasExternalLink: true })).toBe(false);
    expect(shouldAutoOpenCall({ via: "link", useRoom: true, mayEnter: false, hasExternalLink: false })).toBe(false);
  });
});

describe("eventCallAction", () => {
  it("shows the external meeting link instead of the built-in room when one exists", () => {
    expect(eventCallAction({ via: "link", useRoom: true, mayEnter: true, hasExternalLink: true })).toBe("external_link");
  });

  it("shows the Join room button for a confirmed guest when there is no external link", () => {
    expect(eventCallAction(LINKED)).toBe("room_button");
  });

  it("keeps the room locked for someone who is not a confirmed guest", () => {
    expect(eventCallAction({ via: "link", useRoom: true, mayEnter: false, hasExternalLink: false })).toBe("locked");
  });

  it("shows no call control at all for an in-person gathering", () => {
    expect(eventCallAction({ via: "link", useRoom: false, mayEnter: true, hasExternalLink: false })).toBe("none");
  });
});
