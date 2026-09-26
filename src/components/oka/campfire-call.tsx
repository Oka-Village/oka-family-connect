import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DailyIframe, { type DailyCall, type DailyParticipant, type DailyParticipantsObject } from "@daily-co/daily-js";
import { Camera, CameraOff, Flame, Loader2, Mic, MicOff, Minus, PhoneOff, Plus, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { endEventRoom } from "@/lib/video.functions";
import { useServerFn } from "@tanstack/react-start";

type RoomCredentials = { url: string; token: string; isOwner: boolean };
type Phase = "preparing" | "prejoin" | "joining" | "joined" | "left" | "error";

type CampfireCallProps = RoomCredentials & {
  eventId: string;
  displayName: string;
  photoUrl: string | null;
  onClose: () => void;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "O";
}

function asList(participants: DailyParticipantsObject | null) {
  return participants ? Object.values(participants).filter((participant, index, all) => all.findIndex((item) => item.session_id === participant.session_id) === index) : [];
}

function mediaTrack(participant: DailyParticipant | undefined, kind: "audio" | "video") {
  const track = participant?.tracks[kind]?.persistentTrack;
  return track instanceof MediaStreamTrack ? track : null;
}

function MediaTrack({ participant, kind, muted = false, className }: { participant: DailyParticipant | undefined; kind: "audio" | "video"; muted?: boolean | undefined; className?: string | undefined }) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const track = mediaTrack(participant, kind);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.srcObject = track ? new MediaStream([track]) : null;
    if (track) void node.play().catch(() => undefined);
    return () => { node.srcObject = null; };
  }, [track]);

  if (kind === "audio") return <audio ref={(node) => { ref.current = node; }} autoPlay muted={muted} />;
  return <video ref={(node) => { ref.current = node; }} autoPlay playsInline muted={muted} className={className} />;
}

function ParticipantSeat({ participant, size, left, top, active, audioLevel, showVideo }: { participant: DailyParticipant; size: number; left: number; top: number; active: boolean; audioLevel: number; showVideo: boolean }) {
  const name = participant.user_name || (participant.local ? "You" : "Family member");
  const muted = participant.tracks.audio.state === "off" || participant.tracks.audio.state === "blocked";
  const speaking = active || audioLevel > 0.035;
  return (
    <div className="group absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500" style={{ left, top }}>
      <div className={cn("relative overflow-hidden rounded-full border-2 bg-room-surface shadow-fire transition-[width,height,transform,box-shadow,border-color] duration-500", speaking ? "scale-110 border-firelight shadow-fire-speaking" : "border-sand")} style={{ width: size, height: size }}>
        {showVideo && mediaTrack(participant, "video") ? (
          <MediaTrack participant={participant} kind="video" muted={participant.local} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary font-serif text-foreground" style={{ fontSize: Math.max(11, size * 0.32) }}>{initials(name)}</div>
        )}
        {muted && <span className="absolute bottom-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-room-control text-primary-foreground"><MicOff className="size-3" strokeWidth={1.5} /></span>}
      </div>
      <span className="pointer-events-none absolute left-1/2 top-full mt-2 max-w-28 -translate-x-1/2 truncate rounded-full bg-room-control px-2.5 py-1 text-[10px] text-primary-foreground opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{participant.local ? "You" : name}</span>
    </div>
  );
}

function Fire() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
      <div className="campfire-glow" />
      <div className="campfire-flames">
        <span className="campfire-flame campfire-flame-back" />
        <span className="campfire-flame campfire-flame-mid" />
        <span className="campfire-flame campfire-flame-front" />
      </div>
      <div className="campfire-logs"><span /><span /></div>
    </div>
  );
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function CampfireStage({ participants, seatOf, activeId, levels, visibleVideos, children }: { participants: DailyParticipant[]; seatOf: (id: string) => number; activeId: string | null; levels: Record<string, number>; visibleVideos: Set<string>; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setBox({ w: entry.contentRect.width, h: entry.contentRect.height }); });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const clampView = useCallback((zoom: number, x: number, y: number) => {
    const el = ref.current;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    return { zoom, x: Math.min(0, Math.max(w - w * zoom, x)), y: Math.min(0, Math.max(h - h * zoom, y)) };
  }, []);

  const zoomAt = useCallback((next: number, px: number, py: number) => {
    const current = viewRef.current;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const k = zoom / current.zoom;
    setView(clampView(zoom, px - (px - current.x) * k, py - (py - current.y) * k));
  }, [clampView]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      zoomAt(viewRef.current.zoom * Math.exp(-dy * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewRef.current.zoom };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(event.pointerId);
    if (!prev) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = event.currentTarget.getBoundingClientRect();
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(pinch.current.zoom * (dist / pinch.current.dist), (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
    } else if (viewRef.current.zoom > 1) {
      const current = viewRef.current;
      setView(clampView(current.zoom, current.x + event.clientX - prev.x, current.y + event.clientY - prev.y));
    }
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  // One ring at every count; seats shrink smoothly so everyone fits evenly.
  const n = Math.max(participants.length, 1);
  const d = Math.min(box.w, box.h);
  const radius = d * 0.36;
  const seatSize = Math.max(28, Math.min(d * 0.26, ((2 * Math.PI * radius) / n) * 0.78));
  const order = [...participants].sort((a, b) => seatOf(a.session_id) - seatOf(b.session_id));

  const center = () => ({ x: (ref.current?.clientWidth ?? 0) / 2, y: (ref.current?.clientHeight ?? 0) / 2 });

  return (
    <div ref={ref} className={cn("absolute inset-0 touch-none overflow-hidden", view.zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
      <div className="absolute inset-0 origin-top-left transition-transform duration-75 ease-out" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <div className="absolute inset-0 campfire-ambience" />
        <Fire />
        {order.map((participant, index) => {
          const angle = -Math.PI / 2 + (index / n) * Math.PI * 2;
          return <ParticipantSeat key={participant.session_id} participant={participant} size={seatSize} left={box.w / 2 + Math.cos(angle) * radius} top={box.h / 2 + Math.sin(angle) * radius} active={participant.session_id === activeId} audioLevel={levels[participant.session_id] ?? 0} showVideo={visibleVideos.has(participant.session_id)} />;
        })}
      </div>
      <div className="absolute bottom-24 left-4 z-30 flex flex-col gap-1 rounded-full bg-room-control/80 p-1 shadow-soft md:bottom-auto md:left-auto md:right-4 md:top-4">
        <Button size="icon" variant="ghost" className="size-9 rounded-full text-primary-foreground hover:bg-firelight/20 hover:text-primary-foreground" aria-label="Zoom in" onClick={() => { const c = center(); zoomAt(view.zoom * 1.4, c.x, c.y); }}><Plus strokeWidth={1.5} /></Button>
        <Button size="icon" variant="ghost" className="size-9 rounded-full text-primary-foreground hover:bg-firelight/20 hover:text-primary-foreground" aria-label="Zoom out" disabled={view.zoom <= MIN_ZOOM} onClick={() => { const c = center(); zoomAt(view.zoom / 1.4, c.x, c.y); }}><Minus strokeWidth={1.5} /></Button>
      </div>
      {children}
    </div>
  );
}

function SpeakerPane({ participant, expanded, onToggle }: { participant: DailyParticipant | undefined; expanded?: boolean | undefined; onToggle?: (() => void) | undefined }) {
  const name = participant?.user_name || "The circle is listening";
  const hasVideo = !!mediaTrack(participant, "video");
  return (
    <button type="button" onClick={onToggle} className={cn("relative h-full w-full overflow-hidden bg-room-surface text-left", onToggle && "cursor-pointer rounded-2xl border border-firelight/40 shadow-lifted")} aria-label={onToggle ? (expanded ? "Return speaker to corner" : "Expand active speaker") : undefined}>
      {hasVideo ? <MediaTrack participant={participant} kind="video" muted={participant?.local} className="h-full w-full object-cover" /> : (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-room-surface px-6 text-center">
          <Avatar className="size-24 border-2 border-firelight/50 shadow-fire"><AvatarFallback className="bg-secondary font-serif text-3xl text-foreground">{initials(name)}</AvatarFallback></Avatar>
          <p className="font-serif text-2xl text-foreground">{name}</p>
        </div>
      )}
      {participant && <div className="absolute inset-x-0 bottom-0 bg-room-control/85 px-4 py-3 text-sm text-primary-foreground">{participant.local ? "You" : name}</div>}
    </button>
  );
}

export function CampfireCall({ eventId, url, token, isOwner, displayName, photoUrl, onClose }: CampfireCallProps) {
  const endRoom = useServerFn(endEventRoom);
  const callRef = useRef<DailyCall | null>(null);
  const seatMap = useRef(new Map<string, number>());
  const nextSeat = useRef(0);
  const [phase, setPhase] = useState<Phase>("preparing");
  const [participants, setParticipants] = useState<DailyParticipantsObject | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [split, setSplit] = useState(58);
  const [mobileSpeakerOpen, setMobileSpeakerOpen] = useState(false);
  const dragging = useRef(false);

  const refresh = useCallback(() => {
    const call = callRef.current;
    if (!call || call.isDestroyed()) return;
    const next = call.participants();
    for (const participant of asList(next)) {
      if (!seatMap.current.has(participant.session_id)) {
        seatMap.current.set(participant.session_id, nextSeat.current);
        nextSeat.current += 1;
      }
    }
    setParticipants({ ...next });
    const local = next.local;
    if (local) {
      setMicOn(local.tracks.audio.state !== "off" && local.tracks.audio.state !== "blocked");
      setCamOn(local.tracks.video.state !== "off" && local.tracks.video.state !== "blocked");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let call: DailyCall | null = null;
    void (async () => {
      try {
        // React development mode mounts effects twice. Yield so the discarded
        // effect can cancel before Daily's single call object is created.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (cancelled) return;
        call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: false,
        });
        callRef.current = call;
        const onParticipant = () => refresh();
        const onSpeaker = (event: { activeSpeaker?: { peerId?: string } }) => {
          const id = event.activeSpeaker?.peerId ?? null;
          setActiveId(id);
          if (id) setRecents((old) => [id, ...old.filter((item) => item !== id)].slice(0, 3));
        };
        const onRemoteLevel = (event: { participantsAudioLevel?: Record<string, number> }) => setLevels((old) => ({ ...old, ...(event.participantsAudioLevel ?? {}) }));
        const onLocalLevel = (event: { audioLevel?: number }) => {
          const localId = call?.participants().local?.session_id;
          if (localId) setLevels((old) => ({ ...old, [localId]: event.audioLevel ?? 0 }));
        };
        const onLeft = () => setPhase("left");
        const onError = () => { setMessage("The fire went quiet. Please try joining again."); setPhase("error"); };
        call.on("participant-joined", onParticipant).on("participant-updated", onParticipant).on("participant-left", onParticipant)
          .on("track-started", onParticipant).on("track-stopped", onParticipant)
          .on("active-speaker-change", onSpeaker).on("remote-participants-audio-level", onRemoteLevel)
          .on("local-audio-level", onLocalLevel).on("left-meeting", onLeft).on("error", onError);
        await call.preAuth({ url, token });
        try {
          await call.startCamera({ url, token, userName: displayName });
        } catch (error) {
          console.warn("Daily camera preview unavailable", error);
          setMicOn(false);
          setCamOn(false);
          setMessage("Camera preview isn't available here. You can still take your seat and turn it on inside.");
        }
        if (cancelled) return;
        refresh();
        setPhase("prejoin");
      } catch (error) {
        console.error("Daily room preparation failed", error);
        if (!cancelled) { setMessage("We couldn't prepare your camera and microphone. Check your browser permissions and try again."); setPhase("error"); }
      }
    })();
    return () => {
      cancelled = true;
      if (call && !call.isDestroyed()) void call.destroy();
      callRef.current = null;
    };
  }, [displayName, refresh, token, url]);

  const ordered = useMemo(() => asList(participants).sort((a, b) => (seatMap.current.get(a.session_id) ?? 0) - (seatMap.current.get(b.session_id) ?? 0)), [participants]);
  const local = participants?.local;
  const active = activeId ? participants?.[activeId] : undefined;
  const speaker = active ?? ordered.find((participant) => !participant.local) ?? local;
  const visibleVideos = useMemo(() => new Set([activeId, local?.session_id, ...recents].filter((id): id is string => !!id)), [activeId, local?.session_id, recents]);

  useEffect(() => {
    const call = callRef.current;
    if (!call || phase !== "joined") return;
    const updates = Object.fromEntries(ordered.filter((participant) => !participant.local).map((participant) => [participant.session_id, { setSubscribedTracks: { audio: true, video: visibleVideos.has(participant.session_id), screenVideo: false, screenAudio: false } }]));
    if (Object.keys(updates).length) call.updateParticipants(updates);
  }, [ordered, phase, visibleVideos]);

  async function takeSeat() {
    const call = callRef.current;
    if (!call) return;
    setPhase("joining");
    setMessage(null);
    try {
      await call.join({ url, token, userName: displayName });
      await Promise.all([call.startLocalAudioLevelObserver(200), call.startRemoteParticipantsAudioLevelObserver(200)]);
      refresh();
      setPhase("joined");
    } catch {
      setMessage("Your seat couldn't be opened just now. Please try again.");
      setPhase("error");
    }
  }

  async function leave(endForEveryone = false) {
    const call = callRef.current;
    if (!call) { onClose(); return; }
    if (endForEveryone && isOwner) {
      const remoteUpdates = Object.fromEntries(ordered.filter((participant) => !participant.local).map((participant) => [participant.session_id, { eject: true as const }]));
      if (Object.keys(remoteUpdates).length) call.updateParticipants(remoteUpdates);
      await endRoom({ data: { eventId } }).catch(() => undefined);
    }
    await call.leave().catch(() => undefined);
    onClose();
  }

  function moveDivider(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const bounds = parent.getBoundingClientRect();
    setSplit(Math.min(72, Math.max(35, ((event.clientX - bounds.left) / bounds.width) * 100)));
  }

  if (phase === "preparing") return <div className="fixed inset-0 z-[100] grid place-items-center bg-room-surface"><p className="flex items-center gap-3 font-serif text-2xl text-firelight"><Loader2 className="size-5 animate-spin" strokeWidth={1.5} /> Lighting the fire…</p></div>;

  if (phase === "prejoin" || phase === "joining" || phase === "error") {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-room-surface p-6">
        <div className="w-full max-w-xl text-center">
          <p className="section-label text-firelight">Before the gathering</p>
          <div className="relative mx-auto mt-6 aspect-video max-w-lg overflow-hidden rounded-2xl bg-room-control">
            {camOn && mediaTrack(local, "video") ? <MediaTrack participant={local} kind="video" muted className="h-full w-full object-cover" /> : (
              <div className="flex h-full items-center justify-center"><Avatar className="size-28 border-2 border-firelight"><AvatarImage src={photoUrl ?? undefined} alt="" /><AvatarFallback className="bg-secondary font-serif text-4xl text-foreground">{initials(displayName)}</AvatarFallback></Avatar></div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-room-control/85 px-4 py-3 text-left text-sm text-primary-foreground">{displayName}</div>
          </div>
          <div className="mt-5 flex justify-center gap-3">
            <Button type="button" size="icon" variant={micOn ? "secondary" : "outline"} className="size-11 rounded-full" aria-label={micOn ? "Mute microphone" : "Turn on microphone"} onClick={() => { const next = !micOn; callRef.current?.setLocalAudio(next); setMicOn(next); }}>{micOn ? <Mic strokeWidth={1.5} /> : <MicOff strokeWidth={1.5} />}</Button>
            <Button type="button" size="icon" variant={camOn ? "secondary" : "outline"} className="size-11 rounded-full" aria-label={camOn ? "Turn off camera" : "Turn on camera"} onClick={() => { const next = !camOn; callRef.current?.setLocalVideo(next); setCamOn(next); }}>{camOn ? <Camera strokeWidth={1.5} /> : <CameraOff strokeWidth={1.5} />}</Button>
          </div>
          {message && <p className="mt-5 text-sm text-firelight">{message}</p>}
          <div className="mt-6 flex flex-col items-center"><Button size="lg" className=" rounded-full px-8" disabled={phase === "joining"} onClick={() => void takeSeat()}>{phase === "joining" ? <Loader2 className="animate-spin" strokeWidth={1.5} /> : <Flame strokeWidth={1.5} />} Take your seat by the fire</Button>
          <Button variant="ghost" className="mt-3 rounded-full" onClick={onClose}>Not now</Button></div>
        </div>
      </div>
    );
  }

  if (phase === "left") return <div className="fixed inset-0 z-[100] grid place-items-center bg-room-surface text-center"><div><Flame className="mx-auto size-7 text-firelight" strokeWidth={1.5} /><p className="mt-4 font-serif text-3xl text-room-foreground">Until the next gathering</p><Button className="mt-6 rounded-full" onClick={onClose}>Return to the event</Button></div></div>;

  return (
    <div className="fixed inset-0 z-[100] isolate overflow-hidden bg-room-background">
      <div className="hidden h-full min-h-[560px] md:flex" onPointerMove={moveDivider} onPointerUp={() => { dragging.current = false; }} onPointerLeave={() => { dragging.current = false; }}>
        <div className="relative overflow-hidden" style={{ width: `${split}%` }}>
          <CampfireStage participants={ordered} seatOf={(id) => seatMap.current.get(id) ?? 0} activeId={activeId} levels={levels} visibleVideos={visibleVideos} />
          <div className="absolute left-5 top-5 z-30 flex items-center gap-2 rounded-full bg-room-control/75 px-3 py-2 text-xs text-primary-foreground"><Users className="size-3.5" strokeWidth={1.5} /> {ordered.length} by the fire</div>
        </div>
        <div role="separator" aria-orientation="vertical" aria-label="Resize campfire and speaker" className="group relative z-30 w-2 shrink-0 cursor-col-resize touch-none bg-firelight/20" onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); }}>
          <span className="absolute left-1/2 top-1/2 h-16 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-firelight transition-transform group-hover:scale-x-150" />
        </div>
        <div className="min-w-0 flex-1 p-3 pl-2"><SpeakerPane participant={speaker} /></div>
      </div>

      <div className="relative h-full min-h-[520px] md:hidden">
        <CampfireStage participants={ordered} seatOf={(id) => seatMap.current.get(id) ?? 0} activeId={activeId} levels={levels} visibleVideos={visibleVideos} />
        <div className={cn("absolute right-4 top-4 z-40 overflow-hidden transition-all duration-300", mobileSpeakerOpen ? "inset-4" : "h-36 w-28")}><SpeakerPane participant={speaker} expanded={mobileSpeakerOpen} onToggle={() => setMobileSpeakerOpen((open) => !open)} /></div>
      </div>

      {ordered.filter((participant) => !participant.local).map((participant) => <MediaTrack key={`audio-${participant.session_id}`} participant={participant} kind="audio" />)}

      <div className="absolute inset-x-0 bottom-4 z-50 flex items-center justify-center gap-3 px-4">
        <div className="flex items-center gap-2 rounded-full border border-firelight/20 bg-room-control/90 p-2 shadow-lifted backdrop-blur">
          <Button size="icon" variant="ghost" className="size-11 rounded-full text-primary-foreground hover:bg-firelight/20 hover:text-primary-foreground" aria-label={micOn ? "Mute microphone" : "Turn on microphone"} onClick={() => { const next = !micOn; callRef.current?.setLocalAudio(next); setMicOn(next); }}>{micOn ? <Mic strokeWidth={1.5} /> : <MicOff strokeWidth={1.5} />}</Button>
          <Button size="icon" variant="ghost" className="size-11 rounded-full text-primary-foreground hover:bg-firelight/20 hover:text-primary-foreground" aria-label={camOn ? "Turn off camera" : "Turn on camera"} onClick={() => { const next = !camOn; callRef.current?.setLocalVideo(next); setCamOn(next); }}>{camOn ? <Camera strokeWidth={1.5} /> : <CameraOff strokeWidth={1.5} />}</Button>
          <Button size="icon" variant="destructive" className="size-11 rounded-full" aria-label="Leave gathering" onClick={() => void leave(false)}><PhoneOff strokeWidth={1.5} /></Button>
          {isOwner && <Button variant="ghost" className="rounded-full text-xs text-primary-foreground hover:bg-firelight/20 hover:text-primary-foreground" onClick={() => { if (window.confirm("End this call for everyone?")) void leave(true); }}><X strokeWidth={1.5} /> End call</Button>}
        </div>
      </div>
    </div>
  );
}
