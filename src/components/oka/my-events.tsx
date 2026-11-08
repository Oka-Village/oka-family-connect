import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { createdEventStatusLabel } from "@/lib/created-event-status";
import { groupEventSeries, type SeriesEvent } from "@/lib/event-series";
import { formatEventDate } from "@/lib/events";

const VISIBLE_STATUSES = ["pending_approval", "published", "rejected", "cancelled"] as const;

/** Events this member created, with the review status an admin sets. */
export function MyEvents() {
  const { data: uid } = useCurrentUserId();
  const q = useQuery({
    queryKey: ["my-events", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,description,event_type,format,starts_at,timezone,capacity,created_by,created_at,photo_url,status")
        .eq("created_by", uid!)
        .in("status", [...VISIBLE_STATUSES])
        .order("starts_at")
        .limit(200);
      if (error) throw error;
      return groupEventSeries((data ?? []) as SeriesEvent[], "upcoming");
    },
  });
  if (!q.data?.length) return null;
  return (
    <div className="mt-8 rounded-2xl bg-accent/60 p-5">
      <p className="section-label">Your events</p>
      <ul className="mt-3 grid gap-2">
        {q.data.map((item) => (
          <li key={item.event.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0">
              <Link to="/events/$eventId" params={{ eventId: item.event.id }} className="font-medium text-foreground hover:underline">
                {item.event.title}
              </Link>
              {item.label && <span className="mt-0.5 block text-xs text-muted-foreground">{item.label}</span>}
            </span>
            <span className="text-muted-foreground">
              {formatEventDate(item.event.starts_at, item.event.timezone)} · {createdEventStatusLabel(item.event.status)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
