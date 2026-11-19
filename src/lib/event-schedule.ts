import { endOfWeek, format, isWithinInterval, startOfWeek } from "date-fns";

/** Split remaining upcoming events into this week vs later (Mon–Sun weeks). */
export function bucketUpcomingEvents<T extends { starts_at: string }>(
  events: T[],
  now = new Date(),
): {
  thisWeek: T[];
  later: T[];
  thisWeekHint: string;
  laterTitle: string;
  laterHint: string;
} {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thisWeek: T[] = [];
  const later: T[] = [];
  for (const event of events) {
    const starts = new Date(event.starts_at);
    if (Number.isNaN(starts.getTime())) continue;
    if (isWithinInterval(starts, { start: weekStart, end: weekEnd })) thisWeek.push(event);
    else later.push(event);
  }
  const rangeStart = now > weekStart ? now : weekStart;
  const laterMonth = later[0] ? format(new Date(later[0].starts_at), "MMMM") : format(now, "MMMM");
  const laterStart = later[0] ? format(new Date(later[0].starts_at), "EEE d MMM") : format(weekEnd, "EEE d MMM");
  return {
    thisWeek,
    later,
    thisWeekHint: `${format(rangeStart, "EEE d")} – ${format(weekEnd, "EEE d MMM")}`,
    laterTitle: `Later in ${laterMonth}`,
    laterHint: `from ${laterStart}`,
  };
}
