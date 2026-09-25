import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, CalendarDays, Coins, Home, Loader2, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/oka/profile-sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { HOUSE_SELECT, PROPERTY_LABELS, formatDay, isoDay, nightsBetween, withSignedHousePhotos, type HouseRow } from "@/lib/houses";
import { sessionErrorMessage, useCredits } from "@/lib/skills";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/houses/$houseId")({
  head: () => ({
    meta: [
      { title: "Home — Oka" },
      { name: "description", content: "A home open to the Oka family." },
      { property: "og:title", content: "Home — Oka" },
      { property: "og:description", content: "A home open to the Oka family." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HouseDetail,
});

function HouseDetail() {
  const { houseId } = Route.useParams();
  const { data: uid } = useCurrentUserId();
  const qc = useQueryClient();
  const [active, setActive] = useState(0);
  const q = useQuery({
    queryKey: ["house", houseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses").select(HOUSE_SELECT).eq("id", houseId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [h] = await withSignedHousePhotos([data as unknown as HouseRow], true);
      return h ?? null;
    },
  });

  if (q.isLoading) return <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>;
  const h = q.data;
  if (!h) return <div className="mx-auto max-w-2xl px-6 py-24 text-center text-muted-foreground">This home isn't available.</div>;
  const mine = uid === h.owner_id;

  async function toggle() {
    if (!h) return;
    const { error } = await supabase.from("houses").update({ status: h.status === "published" ? "archived" : "published" }).eq("id", h.id);
    if (error) { toast.error("That didn't work. Please try again."); return; }
    await Promise.all([qc.invalidateQueries({ queryKey: ["house", houseId] }), qc.invalidateQueries({ queryKey: ["houses"] }), qc.invalidateQueries({ queryKey: ["my-houses"] })]);
  }

  const hero = h.photoUrls[active] ?? h.photoUrls[0];
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
      <Link to="/houses" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> Houses</Link>

      <div className="mt-8">
        {hero ? <img src={hero} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover shadow-soft" />
          : <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-secondary/70"><Home className="size-14 text-primary" strokeWidth={1.25} /></div>}
        {h.photoUrls.length > 1 && (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {h.photoUrls.map((u, i) => (
              <button key={u} type="button" onClick={() => setActive(i)} className={cn("shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-background", i === active ? "ring-primary" : "ring-transparent")}>
                <img src={u} alt="" className="size-20 object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-accent px-3 py-0.5 text-xs uppercase tracking-widest text-accent-foreground">{PROPERTY_LABELS[h.property_type]}</span>
            {h.status !== "published" && <span className="rounded-full bg-muted px-3 py-0.5 text-xs uppercase tracking-widest text-muted-foreground">Unlisted</span>}
          </div>
          <h1 className="mt-4 text-4xl text-foreground lg:text-5xl">{h.title}</h1>
          {h.location_text && <p className="mt-3 flex items-center gap-2 text-muted-foreground"><MapPin className="size-4 text-primary" strokeWidth={1.5} />{h.location_text}</p>}
          {h.description && <p className="mt-8 whitespace-pre-line leading-relaxed text-foreground">{h.description}</p>}
          {h.house_rules && (
            <div className="mt-10">
              <p className="section-label">House rules</p>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground">{h.house_rules}</p>
            </div>
          )}
          <Link to="/members/$memberId" params={{ memberId: h.owner_id }} className="surface-card mt-10 flex items-center gap-4 p-5 hover:shadow-lifted">
            <MemberAvatar src={h.hostPhoto} name={h.owner?.display_name} className="size-14" />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Your host</p>
              <p className="font-serif text-2xl text-foreground">{h.owner?.display_name ?? "Oka member"}</p>
            </div>
          </Link>
        </div>

        <aside>
          {mine ? (
            <div className="surface-card grid gap-3 p-6">
              <p className="section-label">Your home</p>
              <Button asChild variant="outline" className="rounded-full"><Link to="/houses/edit/$houseId" params={{ houseId: h.id }}><Pencil className="size-4 text-primary" strokeWidth={1.5} />Edit</Link></Button>
              <Button variant="outline" className="rounded-full" onClick={() => void toggle()}>
                {h.status === "published" ? <><Archive className="size-4 text-primary" strokeWidth={1.5} />Unlist</> : <><ArchiveRestore className="size-4 text-primary" strokeWidth={1.5} />List again</>}
              </Button>
              <Button asChild className="rounded-full"><Link to="/stays">Stay requests</Link></Button>
            </div>
          ) : h.status === "published" ? <BookingForm houseId={h.id} /> : null}
        </aside>
      </div>
    </div>
  );
}

function BookingForm({ houseId }: { houseId: string }) {
  const qc = useQueryClient();
  const credits = useCredits();
  const minIn = isoDay(2);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const booked = useQuery({
    queryKey: ["house-booked", houseId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("house_booked_ranges", { _house_id: houseId });
      if (error) throw error;
      return data ?? [];
    },
  });
  const nights = nightsBetween(checkIn, checkOut);
  const available = credits.data?.available ?? 0;
  const noCredits = credits.data && available === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nights < 1) { toast.error("Check-out must be after check-in."); return; }
    if (nights > available) { toast.error(sessionErrorMessage(new Error("INSUFFICIENT_CREDITS"))); return; }
    setBusy(true);
    const { error } = await supabase.rpc("request_booking", { _house_id: houseId, _check_in: checkIn, _check_out: checkOut, _message: message });
    setBusy(false);
    if (error) { toast.error(sessionErrorMessage(error)); return; }
    setSent(true);
    await Promise.all([qc.invalidateQueries({ queryKey: ["credits"] }), qc.invalidateQueries({ queryKey: ["house-booked", houseId] }), qc.invalidateQueries({ queryKey: ["stays"] })]);
  }

  if (sent) return (
    <div className="surface-card p-6">
      <p className="section-label">Request sent</p>
      <p className="mt-3 font-serif text-2xl text-foreground">Your host will reply soon</p>
      <p className="mt-2 text-sm text-muted-foreground">We're holding {nights} credit{nights === 1 ? "" : "s"} for you. If the host declines, they come straight back.</p>
      <Button asChild className="mt-5 w-full rounded-full"><Link to="/stays">See my stays</Link></Button>
    </div>
  );

  return (
    <form onSubmit={submit} className="surface-card grid gap-4 p-6">
      <p className="section-label">Request a stay</p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Coins className="size-4 text-primary" strokeWidth={1.5} />1 credit per night · {available} available</p>
      {noCredits ? (
        <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
          Your credits grow when you give. Host a night or offer a skill, and this door will be open to you.
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm" className="rounded-full"><Link to="/houses/new">Host</Link></Button>
            <Button asChild size="sm" variant="outline" className="rounded-full"><Link to="/skills/new">Offer a skill</Link></Button>
          </div>
        </div>
      ) : (
        <>
          <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">Check-in
            <Input type="date" required min={minIn} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(""); }} />
          </label>
          <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">Check-out
            <Input type="date" required min={checkIn || isoDay(3)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
          <Textarea rows={3} maxLength={1000} placeholder="Say hello and share why you're coming" value={message} onChange={(e) => setMessage(e.target.value)} />
          {nights > 0 && <p className="text-sm text-foreground">{nights} night{nights === 1 ? "" : "s"} · {nights} credit{nights === 1 ? "" : "s"}</p>}
          <Button type="submit" className="rounded-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Send request</Button>
          <p className="text-xs text-muted-foreground">Please ask at least 2 days ahead. Stays up to 30 nights.</p>
        </>
      )}
      {booked.data && booked.data.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><CalendarDays className="size-3.5 text-primary" strokeWidth={1.5} />Already taken</p>
          <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
            {booked.data.slice(0, 8).map((r) => <li key={r.check_in}>{formatDay(r.check_in)} → {formatDay(r.check_out)}</li>)}
          </ul>
        </div>
      )}
    </form>
  );
}
