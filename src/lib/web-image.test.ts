import { describe, it, expect } from "vitest";
import { imageDimensions, isHeic, toWebImage } from "./web-image";
describe("isHeic", () => {
  it("detects iPhone photos by name or type", () => {
    expect(isHeic(new File([], "a.HEIC"))).toBe(true);
    expect(isHeic(new File([], "x", { type: "image/heif" }))).toBe(true);
    expect(isHeic(new File([], "a.jpg", { type: "image/jpeg" }))).toBe(false);
  });
});

describe("upload image resizing", () => {
  it("keeps a large landscape photo within 1400 pixels without distorting it", () => {
    expect(imageDimensions(4000, 3000)).toEqual({ width: 1400, height: 1050 });
  });
  it("keeps portrait photos within the same limit", () => {
    expect(imageDimensions(3000, 4000)).toEqual({ width: 1050, height: 1400 });
  });
  it("does not enlarge small photos", () => {
    expect(imageDimensions(200, 100)).toEqual({ width: 200, height: 100 });
  });
  it("keeps files untouched outside the browser", async () => {
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    expect(await toWebImage(file)).toBe(file);
  });
});
