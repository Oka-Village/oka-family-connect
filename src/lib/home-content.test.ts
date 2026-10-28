import { describe, expect, it } from "vitest";
import { dailyQuote, dailyQuoteIndex, INSPIRATION_QUOTES } from "./home-content";

const at = (isoUtc: string) => new Date(isoUtc);
const day = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + n * 86_400_000);

describe("Quote of the Day", () => {
  it("is deterministic: the same day always shows the same quote", () => {
    expect(dailyQuote(at("2026-10-28T00:00:00Z"))).toEqual(dailyQuote(at("2026-10-28T13:45:00Z")));
    expect(dailyQuoteIndex(at("2026-10-28T23:59:00Z"))).toBe(dailyQuoteIndex(at("2026-10-28T00:01:00Z")));
  });

  it("rotates daily: consecutive days show different quotes", () => {
    for (let n = 0; n < 10; n++) {
      expect(dailyQuoteIndex(day(n + 1))).not.toBe(dailyQuoteIndex(day(n)));
    }
  });

  it("cycles through the whole quote library before repeating", () => {
    const seen = new Set(Array.from({ length: INSPIRATION_QUOTES.length }, (_, i) => dailyQuoteIndex(day(i))));
    expect(seen.size).toBe(INSPIRATION_QUOTES.length);
    expect(dailyQuoteIndex(day(INSPIRATION_QUOTES.length))).toBe(dailyQuoteIndex(day(0)));
  });

  it("always returns a quote from the library", () => {
    const quote = dailyQuote(at("2026-10-28T12:00:00Z"));
    expect(INSPIRATION_QUOTES).toContainEqual(quote);
    expect(quote.author.length).toBeGreaterThan(0);
  });
});
