import { describe, expect, it } from "vitest";
import { canAccessMemberRoute, isFullMember, ownEditTarget } from "./member-access";

describe("membership soft launch", () => {
  it("keeps existing full members full before launch", () => {
    expect(isFullMember({ member_status: "full" }, new Date("2026-10-23T08:29:00Z"))).toBe(true);
  });
  it("keeps limited members limited until December 1", () => {
    expect(isFullMember({ member_status: "limited" }, new Date("2026-11-30T23:59:59.999Z"))).toBe(false);
  });
  it("opens limited access on December 1, 2026 at midnight UTC", () => {
    expect(isFullMember({ member_status: "limited" }, new Date("2026-12-01T00:00:00Z"))).toBe(true);
    expect(isFullMember({ member_status: "limited" }, new Date("2027-01-01T00:00:00Z"))).toBe(true);
  });
  it("does not grant access without a profile", () => {
    expect(isFullMember(null, new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
  it.each(["/home", "/home/reflection", "/home/inspiration", "/home/appreciation", "/home/reflection/past", "/directory", "/members", "/members/example", "/events", "/events/example", "/houses", "/houses/example", "/skills", "/skills/example", "/stays", "/sessions", "/collections", "/credits"])("blocks limited browsing at %s", (path) => {
    expect(canAccessMemberRoute(path, false)).toBe(false);
  });
  it.each(["/profile", "/onboarding", "/skills/new", "/houses/new", "/events/new", "/affiliate", "/privacy", "/terms"])("allows limited contribution at %s", (path) => {
    expect(canAccessMemberRoute(path, false)).toBe(true);
  });
  it.each(["/skills/edit/own", "/houses/edit/own", "/events/edit/own"])("allows only owned limited edits at %s", (path) => {
    expect(canAccessMemberRoute(path, false, true)).toBe(true);
    expect(canAccessMemberRoute(path, false, false)).toBe(false);
    expect(ownEditTarget(path)?.id).toBe("own");
  });
  it("leaves full members and staff unrestricted", () => {
    expect(canAccessMemberRoute("/home", true)).toBe(true);
    expect(canAccessMemberRoute("/admin", true)).toBe(true);
  });
});