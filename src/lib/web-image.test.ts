import { describe, it, expect } from "vitest";
import { isHeic } from "./web-image";
describe("isHeic", () => {
  it("detects iPhone photos by name or type", () => {
    expect(isHeic(new File([], "a.HEIC"))).toBe(true);
    expect(isHeic(new File([], "x", { type: "image/heif" }))).toBe(true);
    expect(isHeic(new File([], "a.jpg", { type: "image/jpeg" }))).toBe(false);
  });
});
