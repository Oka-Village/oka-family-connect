import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Video } from "lucide-react";

import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { saveReturnTo } from "@/lib/join-link";
import { saveInviteCode } from "@/lib/affiliates";
import { useServerFn } from "@tanstack/react-start";
import { beginSignupFlow } from "@/lib/signup-flow.functions";

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
      const { data: ev } = await supabase
        .from("events").select("id,status,format,host_id,created_by,starts_at,ends_at").eq("join_slug", slug).maybeSingle();
      if (!ev || ev.status !== "published" || ev.format !== "virtual") { setState("not_found"); return; }

      const isHost = ev.host_id === user.id || ev.created_by === user.id;
      const past = new Date(ev.ends_at ?? ev.starts_at).getTime() < Date.now();
      if (!isHost && !past) {
        const { data: mine } = await supabase.from("event_rsvps").select("status").eq("event_id", ev.id).eq("user_id", user.id).maybeSingle();
        // Same RPC as the RSVP button: capacity and waitlist rules are enforced in the database.
        if (mine?.status !== "going" && mine?.status !== "waitlist") await supabase.rpc("rsvp_event", { _event_id: ev.id });
      }
      const dest = `/events/${ev.id}?via=link`;
      const { data: prof } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle();
      if (!prof?.onboarded_at) saveReturnTo(dest); // new members finish the welcome steps, then come back here
      void navigate({ to: "/events/$eventId", params: { eventId: ev.id }, search: { via: "link" }, replace: true });
    })();
  }, [slug, navigate]);

  async function signIn() {
    setBusy(true);
    saveReturnTo(`/join/${slug}`);
    await beginSignup();
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) setBusy(false);
    else if (!res.redirected) window.location.replace(`/join/${slug}`);
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
          <>
            <Video className="mx-auto size-8 text-primary" strokeWidth={1.5} />
            <p className="section-label mt-6">You're invited</p>
            <h1 className="mt-6 text-5xl leading-tight text-foreground">Join the gathering</h1>
            <p className="mx-auto mt-6 max-w-md text-muted-foreground">Sign in with Google and we'll save your spot, then bring you straight to the call.</p>
            <Button size="lg" className="mt-10 rounded-full px-10" disabled={busy} onClick={() => void signIn()}>
              {busy && <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />}Continue with Google
            </Button>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" strokeWidth={1.5} /> Saving your spot…
          </p>
        )}
      </main>
    </div>
  );
}
