import { describe, expect, it, vi } from "vitest";
import { ensureActiveInviteCode } from "./affiliate-code";

describe("personal invitation provisioning", () => {
  it("preserves an existing member's code without activating again", async () => {
    const activate = vi.fn();
    expect(await ensureActiveInviteCode({ read: async () => ({ invite_code: "MEMBER123", status: "active" }), activate })).toBe("MEMBER123");
    expect(activate).not.toHaveBeenCalled();
  });
  it("provisions a missing affiliate and reads the persistent member code back", async () => {
    const read = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ invite_code: "NEW12345", status: "active" });
    const activate = vi.fn().mockResolvedValue(undefined);
    expect(await ensureActiveInviteCode({ read, activate })).toBe("NEW12345");
    expect(activate).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("never reactivates a paused affiliate or exposes its code for sharing", async () => {
    const activate = vi.fn();
    expect(await ensureActiveInviteCode({ read: async () => ({ invite_code: "PAUSED12", status: "paused" }), activate })).toBeNull();
    expect(activate).not.toHaveBeenCalled();
  });
  it("fails instead of returning an untagged link when provisioning fails", async () => {
    await expect(ensureActiveInviteCode({ read: async () => null, activate: async () => undefined })).rejects.toThrow("Couldn't prepare");
  });
});