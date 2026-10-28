export type Repeat = "none" | "daily" | "weekly" | "biweekly" | "monthly";
export const REPEAT_LABELS: Record<Repeat, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};
export const MAX_OCCURRENCES = 52;

const pad = (n: number) => String(n).padStart(2, "0");

/** Wall-clock start times ("YYYY-MM-DDTHH:mm") from the first start through `until` (YYYY-MM-DD, inclusive). */
export function occurrenceStarts(start: string, repeat: Repeat, until: string, max = MAX_OCCURRENCES): string[] {
  if (repeat === "none" || !until) return [start];
  const [date = "", time = ""] = start.split("T");
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; out.length < max; i++) {
    let dt: Date;
    if (repeat === "monthly") {
      const last = new Date(Date.UTC(y, m - 1 + i + 1, 0)).getUTCDate();
      dt = new Date(Date.UTC(y, m - 1 + i, Math.min(d, last)));
    } else {
      const step = repeat === "daily" ? 1 : repeat === "weekly" ? 7 : 14;
      dt = new Date(Date.UTC(y, m - 1, d + i * step));
    }
    const ds = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    if (ds > until) break;
    out.push(`${ds}T${time}`);
  }
  return out.length ? out : [start];
}
