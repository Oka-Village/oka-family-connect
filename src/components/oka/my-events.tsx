import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { createdEventStatusLabel } from "@/lib/created-event-status";
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
        .select("id,title,status,starts_at,timezone")
        .eq("created_by", uid!)
        .in("status", [...VISIBLE_STATUSES])
        .order("starts_at")
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  if (!q.data?.length) return null;
  return (
    <div className="mt-8 rounded-2xl bg-accent/60 p-5">
      <p className="section-label">Your events</p>
      <ul className="mt-3 grid gap-2">
        {q.data.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <Link to="/events/$eventId" params={{ eventId: e.id }} className="font-medium text-foreground hover:underline">
              {e.title}
            </Link>
            <span className="text-muted-foreground">
              {formatEventDate(e.starts_at, e.timezone)} · {createdEventStatusLabel(e.status)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
