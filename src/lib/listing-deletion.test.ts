import { describe, expect, it, vi } from "vitest";
import { canDeleteListing, deleteOwnListing } from "./listing-deletion";

describe("creator-only listing deletion", () => {
  it("allows the creator and rejects other members, including admins", () => {
    expect(canDeleteListing("creator", "creator")).toBe(true);
    expect(canDeleteListing("other-member", "creator")).toBe(false);
    expect(canDeleteListing("admin", "creator")).toBe(false);
    expect(canDeleteListing(null, "creator")).toBe(false);
  });
  it.each(["skills", "houses"] as const)("deletes only the caller's %s row and verifies it was removed", async (table) => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: "listing" }], error: null });
    const ownerEq = vi.fn().mockReturnValue({ select });
    const idEq = vi.fn().mockReturnValue({ eq: ownerEq });
    const from = vi.fn().mockReturnValue({ delete: () => ({ eq: idEq }) });
    await deleteOwnListing({ from }, table, "listing", "creator", "creator");
    expect(from).toHaveBeenCalledWith(table);
    expect(idEq).toHaveBeenCalledWith("id", "listing");
    expect(ownerEq).toHaveBeenCalledWith("owner_id", "creator");
  });
  it("never sends a delete request for another creator's listing", async () => {
    const from = vi.fn();
    await expect(deleteOwnListing({ from }, "skills", "listing", "creator", "admin")).rejects.toThrow("Only the creator");
    expect(from).not.toHaveBeenCalled();
  });
  it("does not report success when database permissions remove no row", async () => {
    const from = vi.fn().mockReturnValue({ delete: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) }) });
    await expect(deleteOwnListing({ from }, "houses", "listing", "creator", "creator")).rejects.toThrow("wasn't deleted");
  });
});