import { describe, expect, it } from "vitest";
import { createdEventStatusLabel } from "./created-event-status";

describe("created event status", () => {
  it("names each review outcome", () => {
    expect(createdEventStatusLabel("pending_approval")).toBe("Awaiting review");
    expect(createdEventStatusLabel("published")).toBe("Approved");
    expect(createdEventStatusLabel("rejected")).toBe("Not approved");
    expect(createdEventStatusLabel("cancelled")).toBe("Cancelled");
  });
});
