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
      {display.local ? (
        <>
          <span className="block font-semibold">{display.local}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{display.primary}</span>
        </>
      ) : (
        <span className="block">{display.primary}</span>
      )}
    </span>
  );
}

/** The visitor's own timezone, resolved only after hydration so SSR markup stays stable. */
export function ViewerTimezone() {
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  return <span>{zone ?? "…"}</span>;
}