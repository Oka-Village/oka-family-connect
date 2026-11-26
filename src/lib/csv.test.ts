import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
describe("toCsv", () => {
  it("escapes quotes and neutralises formulas", () => {
    expect(toCsv([["a\"b", "=SUM(1)"]])).toBe('\uFEFF"a""b","\'=SUM(1)"');
  });
});
