import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinEventRoom } from "@/lib/video.functions";

const EARLY_MS = 15 * 60 * 1000;

function countdown(ms: number) {
  const m = Math.ceil(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${min}m`;
  return `${min} min`;
}

export function VideoRoom({ eventId, startsAt, bypassTiming, autoJoin = false }: { eventId: string; startsAt: string; bypassTiming: boolean; autoJoin?: boolean }) {
  const join = useServerFn(joinEventRoom);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const opensIn = new Date(startsAt).getTime() - EARLY_MS - now;
  const open = bypassTiming || opensIn <= 0;

  // Arriving from a shared join link during the event window: go straight into the room.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoJoin && open && !autoTried.current && !room) {
      autoTried.current = true;
      void onJoin();
    }
  });

  async function onJoin() {
    setBusy(true); setMsg(null);
    try {
      const r = await join({ data: { eventId } });
      if (r.status === "ok") setRoom(`${r.url}?t=${encodeURIComponent(r.token)}`);
      else if (r.status === "not_configured") setMsg("Video isn't available right now.");
      else setMsg(r.message);
    } catch {
      setMsg("The room couldn't open just now. Please try again.");
    } finally { setBusy(false); }
  }

  if (room) {
    return (
      <div className="mt-3">
        <div className="overflow-hidden rounded-2xl bg-foreground shadow-lifted">
          <iframe title="Event room" src={room} allow="camera; microphone; fullscreen; display-capture; autoplay" className="aspect-video min-h-[420px] w-full border-0" />
        </div>
        <Button variant="outline" className="mt-3 rounded-full" onClick={() => setRoom(null)}>
          <X className="size-4" strokeWidth={1.5} /> Leave room
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-4">
      <Button className="rounded-full" disabled={!open || busy} onClick={onJoin}>
        {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : <Video className="size-4" strokeWidth={1.5} />}
        Join room
      </Button>
      <p className="text-sm text-muted-foreground">
        {msg ?? (open ? "The room is open — step inside when you're ready." : `The room opens in ${countdown(opensIn)}, 15 minutes before we begin.`)}
      </p>
    </div>
  );
}
