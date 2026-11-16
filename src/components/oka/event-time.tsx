import { useEffect, useState } from "react";
import { formatEventTimeDual } from "@/lib/event-time";

export function EventTime({ start, end, timezone }: { start: string; end?: string | null; timezone: string | null }) {
  const [viewerTimezone, setViewerTimezone] = useState<string | null>(null);
  useEffect(() => {
    setViewerTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  const display = formatEventTimeDual(start, end, timezone, viewerTimezone);
  return (
    <span className="min-w-0 break-words">
      <span className="block">{display.primary}</span>
      {display.local && <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{display.local}</span>}
    </span>
  );
}