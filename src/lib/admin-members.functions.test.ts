import { describe, expect, it } from "vitest";
import { filterAdminMembers } from "./admin-members.functions";

const rows = [
  { id: "1", display_name: "Zoe", email: "zoe@x.com" },
  { id: "2", display_name: null, email: "shabana@y.com" },
  { id: "3", display_name: "Anna", email: "anna@x.com" },
];

describe("filterAdminMembers", () => {
  it("finds members by email even without a name", () => {
    expect(filterAdminMembers(rows, "SHABANA", 0, 25).page.map((r) => r.id)).toEqual(["2"]);
  });
  it("lists named members alphabetically, unnamed last", () => {
    expect(filterAdminMembers(rows, "", 0, 25).page.map((r) => r.id)).toEqual(["3", "1", "2"]);
  });
  it("pages beyond the first batch", () => {
    const r = filterAdminMembers(rows, "", 2, 2);
    expect(r.page.map((x) => x.id)).toEqual(["2"]);
    expect(r.total).toBe(3);
  });
});
