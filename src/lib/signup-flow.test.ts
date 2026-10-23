import { describe, expect, it } from "vitest";
import { isNewFlowAccount } from "./signup-flow";

const start = Date.parse("2026-10-23T13:00:00Z");
describe("future new-flow signup initialization", () => {
  it("initializes an account created after the pre-Google marker", () => {
    expect(isNewFlowAccount("2026-10-23T13:00:01Z", start, start + 2000)).toBe(true);
  });
  it("never initializes an existing account", () => {
    expect(isNewFlowAccount("2026-10-23T12:59:59Z", start, start + 2000)).toBe(false);
  });
  it("rejects missing, future or expired attempts", () => {
    expect(isNewFlowAccount("2026-10-23T13:00:01Z", 0, start + 2000)).toBe(false);
    expect(isNewFlowAccount("2026-10-23T13:00:01Z", start + 3000, start + 2000)).toBe(false);
    expect(isNewFlowAccount("2026-10-23T13:00:01Z", start, start + 3600001)).toBe(false);
  });
});