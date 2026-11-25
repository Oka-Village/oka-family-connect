import { describe, expect, it } from "vitest";
import { formatStayDates, stayStatusGuestNotice } from "./exchange-notifications";

describe("exchange notifications", () => {
  it("formats stay dates without timezone drift", () => {
    expect(formatStayDates("2026-12-01", "2026-12-04")).toBe("Dec 1, 2026 – Dec 4, 2026");
  });
  it("declined stays tell the guest credits were returned", () => {
    const n = stayStatusGuestNotice({ firstName: "A", title: "Casa", host: "B", dates: "x", approved: false, url: "u" });
    expect(n.paragraphs.join(" ")).toContain("credits have been returned");
  });
});
