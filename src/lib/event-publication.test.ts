import { describe, expect, it } from "vitest";
import { canChangeEventStatus, eventBelongsToMember } from "./event-publication";

const event = { status: "published", host_id: "host", created_by: "creator" };
describe("approved event publication", () => {
  it("only staff can unpublish a published event", () => {
    expect(canChangeEventStatus(event, "staff", true, "unpublished")).toBe(true);
    expect(canChangeEventStatus(event, "host", false, "unpublished")).toBe(false);
    expect(canChangeEventStatus({ ...event, status: "pending_approval" }, "staff", true, "unpublished")).toBe(false);
  });
  it("host and creator can republish an approved-unpublished event", () => {
    for (const id of ["host", "creator"]) expect(canChangeEventStatus({ ...event, status: "unpublished" }, id, false, "published")).toBe(true);
    expect(canChangeEventStatus({ ...event, status: "unpublished" }, "other", false, "published")).toBe(false);
  });
  it("members cannot self-approve drafts, pending or rejected proposals", () => {
    for (const status of ["draft", "pending_approval", "rejected", "cancelled"]) expect(canChangeEventStatus({ ...event, status }, "host", false, "published")).toBe(false);
  });
  it("member filter includes hosted and created events regardless of status", () => {
    for (const status of ["draft", "pending_approval", "published", "unpublished", "rejected", "cancelled", "completed"]) {
      const row = { ...event, status };
      expect(eventBelongsToMember(row, "creator")).toBe(true);
      expect(eventBelongsToMember(row, "host")).toBe(true);
      expect(eventBelongsToMember(row, "other")).toBe(false);
    }
  });
});