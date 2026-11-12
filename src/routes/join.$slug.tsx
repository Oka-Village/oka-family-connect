import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock, Loader2, Users, Video } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatEventDate, formatEventTime } from "@/lib/events";

import { toast } from "sonner";
import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { saveReturnTo } from "@/lib/join-link";
import { claimEventInvite, saveEventJoinSlug } from "@/lib/event-invite";
import { saveInviteCode } from "@/lib/affiliates";
import { useServerFn } from "@tanstack/react-start";
import { beginSignupFlow } from "@/lib/signup-flow.functions";
import { getPublicEventPhoto } from "@/lib/public-event-photo.functions";

export const Route = createFileRoute("/join/$slug")({
  head: () => ({
    meta: [
      { title: "Join the gathering — Oka" },
      { name: "description", content: "You've been invited to an Oka video gathering. Sign in to save your spot and join the call." },
      { property: "og:title", content: "Join the gathering — Oka" },
      { property: "og:description", content: "You've been invited to an Oka video gathering. Sign in to save your spot and join the call." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

type State = "checking" | "signed_out" | "joining" | "not_found";

function JoinPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const beginSignup = useServerFn(beginSignupFlow);
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);
  const preview = useQuery({
    queryKey: ["public-event", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_event_preview", { _slug: slug });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: state === "signed_out",
    refetchInterval: 60_000,
  });

  const fetchPhoto = useServerFn(getPublicEventPhoto);
  const cover = useQuery({
    queryKey: ["public-event-photo", slug],
    queryFn: async () => (await fetchPhoto({ data: { slug } })).url,
    enabled: state === "signed_out" && !!preview.data,
    staleTime: 30 * 60_000,
  });

  useEffect(() => {
    saveEventJoinSlug(slug);
  }, [slug]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // A sharer's affiliate code rides along as ?ref=; store it exactly like /invite/<code> does.
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref?.trim()) saveInviteCode(ref);
    void (async () => {
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user;
      if (!user) { setState("signed_out"); return; }
      setState("joining");
      try {
        const eventId = await claimEventInvite(slug, user.id);
        if (!eventId) { setState("not_found"); return; }
        const dest = `/events/${eventId}?via=link`;
        const { data: prof } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle();
        if (!prof?.onboarded_at) saveReturnTo(dest); // new members finish the welcome steps, then come back here
        void navigate({ to: "/events/$eventId", params: { eventId }, search: { via: "link" }, replace: true });
      } catch (e) {
        setState("not_found");
        toast.error(e instanceof Error ? e.message : "We couldn't open this gathering. Please try again.");
      }
    })();
  }, [slug, navigate]);

  async function signIn() {
    setBusy(true);
    saveReturnTo(`/join/${slug}`);
    try {
      await beginSignup();
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (res.error) {
        setBusy(false);
        toast.error(res.error instanceof Error ? res.error.message : "We couldn't open Google sign-in. Please try again.");
      } else if (!res.redirected) window.location.replace(`/join/${slug}`);
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "We couldn't open Google sign-in. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center px-6 py-8"><Wordmark /></header>
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-12 text-center">
        {state === "not_found" ? (
          <>
            <p className="section-label">Gathering link</p>
            <h1 className="mt-6 text-5xl leading-tight text-foreground">This gathering link doesn't lead anywhere</h1>
            <p className="mx-auto mt-6 max-w-md text-muted-foreground">It may have ended, been cancelled, or the link was mistyped. There's always something else on the calendar.</p>
            <Button asChild size="lg" className="mt-10 rounded-full px-10"><Link to="/events">See all events</Link></Button>
          </>
        ) : state === "signed_out" ? (
          preview.isLoading ? (
            <p className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" strokeWidth={1.5} /> Opening the event…</p>
          ) : preview.data ? (
            <div className="text-left">
              <p className="section-label text-center">You're invited</p>
              <h1 className="mt-6 text-center text-5xl leading-tight text-foreground">{preview.data.title}</h1>
              {cover.data && <img src={cover.data} alt="" className="mt-8 h-auto w-full rounded-3xl object-contain object-center shadow-soft" />}
              <div className="mt-8 grid gap-3 rounded-2xl border border-border bg-card p-6 text-foreground shadow-soft sm:grid-cols-2">
                <span className="flex items-center gap-3"><CalendarDays className="size-5 text-primary" strokeWidth={1.5} />{formatEventDate(preview.data.starts_at, preview.data.timezone)}</span>
                <span className="flex items-center gap-3"><Clock className="size-5 text-primary" strokeWidth={1.5} />{formatEventTime(preview.data.starts_at, preview.data.timezone)}{preview.data.ends_at && ` – ${formatEventTime(preview.data.ends_at, preview.data.timezone)}`}</span>
                {preview.data.host_name && <span className="flex items-center gap-3"><Users className="size-5 text-primary" strokeWidth={1.5} />Hosted by {preview.data.host_name}</span>}
                <span className="flex items-center gap-3"><Video className="size-5 text-primary" strokeWidth={1.5} />{preview.data.format === "virtual" ? "Online" : "In person"} · {preview.data.going_count} going</span>
              </div>
              <p className="section-label mt-10">About</p>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground">{preview.data.description || "More details soon."}</p>
              <div className="mt-10 flex flex-col items-center gap-3">
                {preview.data.live_link ? (
                  <>
                    <Button asChild size="lg" className="rounded-full px-10"><a href={preview.data.live_link} target="_blank" rel="noreferrer">Join the call now</a></Button>
                    <p className="text-sm text-muted-foreground">It's live — anyone can join.</p>
                    <Button variant="ghost" className="rounded-full" disabled={busy} onClick={() => void signIn()}>Sign in or sign up to RSVP</Button>
                  </>
                ) : (
                  <>
                    <Button size="lg" className="rounded-full px-10" disabled={busy} onClick={() => void signIn()}>
                      {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Sign in or sign up to RSVP
                    </Button>
                    {preview.data.is_live && <p className="text-sm text-muted-foreground">It's live now — sign in to join the room.</p>}
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <Video className="mx-auto size-8 text-primary" strokeWidth={1.5} />
              <p className="section-label mt-6">You're invited</p>
              <h1 className="mt-6 text-5xl leading-tight text-foreground">Join the gathering</h1>
              <p className="mx-auto mt-6 max-w-md text-muted-foreground">Sign in with Google and we'll save your spot, then bring you straight to the call.</p>
              <Button size="lg" className="mt-10 rounded-full px-10" disabled={busy} onClick={() => void signIn()}>
                {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Continue with Google
              </Button>
            </>
          )
        ) : (
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" strokeWidth={1.5} /> Saving your spot…
          </p>
        )}
      </main>
    </div>
  );
}
