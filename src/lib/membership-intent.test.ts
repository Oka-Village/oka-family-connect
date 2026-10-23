import { describe, expect, it } from "vitest";
import { parseIntent, resolveIntent } from "./membership-intent";

describe("membership intent", () => {
  it("resumes the kind from the URL with stored terms acceptance", () => {
    expect(resolveIntent("monthly", { kind: "monthly", agreed: true })).toEqual({ kind: "monthly", agreed: true });
  });
  it("falls back to stored intent when the URL param is dropped", () => {
    expect(resolveIntent(undefined, { kind: "founding", agreed: true })).toEqual({ kind: "founding", agreed: true });
  });
  it("never treats terms as accepted for a different plan than the one stored", () => {
    expect(resolveIntent("founding", { kind: "monthly", agreed: true })).toEqual({ kind: "founding", agreed: false });
  });
  it("rejects malformed stored values", () => {
    expect(parseIntent('{"kind":"lifetime","agreed":true}')).toBeNull();
  });
});
