import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getEventAttendees } from "@/lib/event-attendees.functions";
import { toCsv } from "@/lib/csv";

export function EventAttendees({ eventId, title }: { eventId: string; title: string }) {
  const fetchAttendees = useServerFn(getEventAttendees);
  const q = useQuery({ queryKey: ["event-attendees", eventId], queryFn: () => fetchAttendees({ data: { eventId } }) });
  const going = (q.data ?? []).filter((a) => a.status === "going");
  const download = () => {
    const csv = toCsv([["Name", "Email", "Phone", "Status", "RSVP date"], ...(q.data ?? []).map((a) => [a.name, a.email, a.phone, a.status, a.rsvp_at.slice(0, 10)])]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-attendees.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-2xl bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">Attendees · {going.length} going</p>
        {!!q.data?.length && <Button size="sm" variant="outline" className="rounded-full" onClick={download}><Download className="size-4 text-primary" strokeWidth={1.5} /> CSV</Button>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Visible only to the host and admins.</p>
      {q.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="mt-3 text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No RSVPs yet.</p>}
      <ul className="mt-3 grid gap-3">
        {q.data?.map((a) => (
          <li key={a.id} className="text-sm">
            <p className="font-medium">{a.name}{a.status === "waitlist" && <span className="ml-2 text-xs text-muted-foreground">(waitlist)</span>}</p>
            {a.email ? <a href={`mailto:${a.email}`} className="break-all text-muted-foreground hover:text-primary">{a.email}</a> : <p className="text-muted-foreground">No email</p>}
            <p className="text-xs text-muted-foreground">Phone: {a.phone ?? "—"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
