import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Check, Copy, Gift, Home, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({
    meta: [
      { title: "Make yourself at home · Oka" },
      { name: "description", content: "A few gentle first steps while your place in the family is kept." },
      { property: "og:title", content: "Make yourself at home · Oka" },
      { property: "og:description", content: "A few gentle first steps while your place in the family is kept." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

async function hasRow(table: "skills" | "houses", uid: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("owner_id", uid);
  if (error) throw error;
  return (count ?? 0) > 0;
}

function Welcome() {
  const uid = useProfile().data?.id;
  const progress = useQuery({
    queryKey: ["welcome-checklist", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const id = uid!;
      const [skill, house, events, aff, stats] = await Promise.all([
        hasRow("skills", id),
        hasRow("houses", id),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("created_by", id),
        supabase.from("affiliates").select("invite_code").eq("user_id", id).maybeSingle(),
        supabase.rpc("affiliate_referral_stats", {}),
      ]);
      return {
        skill, house,
        event: (events.count ?? 0) > 0,
        inviteCode: aff.data?.invite_code ?? null,
        invited: !stats.error && Array.isArray(stats.data) && stats.data.length > 0,
      };
    },
  });
  const p = progress.data;
  const link = p?.inviteCode && typeof window !== "undefined" ? `${window.location.origin}/invite/${p.inviteCode}` : "";

  async function copy() {
    try { await navigator.clipboard.writeText(link); toast.success("Invite link copied"); }
    catch { toast.error("Couldn't copy — select the link and copy it by hand."); }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <p className="section-label">Welcome to Oka</p>
      <h1 className="mt-4 text-4xl text-foreground sm:text-5xl">Make yourself at home</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">Four small ways to begin, whenever you're ready.</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Item to="/skills/new" icon={Sparkles} title="Add a skill" hint="Something you'd love to share." done={p?.skill} />
        <Item to="/houses/new" icon={Home} title="Add your house" hint="A door you could open to family." done={p?.house} />
        <Item to="/events/new" icon={CalendarPlus} title="Add an event" hint="A gathering, a walk, a circle." done={p?.event} />
        <Item to="/affiliate" icon={Gift} title="Invite friends" hint="Bring someone you'd trust with your home." done={p?.invited}>
          {!p?.invited && link && (
            <div className="mt-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-full bg-secondary px-4 py-2 text-xs text-secondary-foreground">{link}</code>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void copy()}><Copy className="size-4 text-primary" strokeWidth={1.5} />Copy</Button>
            </div>
          )}
        </Item>
      </div>

      <section className="surface-card mt-10 p-7 text-center sm:p-10">
        <h2 className="text-3xl text-foreground">Your place in the family is kept.</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">Full access opens on December 1. Until then you can add what you'd love to offer and complete your <Link to="/profile" className="text-primary underline-offset-4 hover:underline">profile</Link> — the rest of the app opens at the soft launch.</p>
      </section>
    </div>
  );
}

function Item({ to, icon: Icon, title, hint, done, children }: { to: "/skills/new" | "/houses/new" | "/events/new" | "/affiliate"; icon: LucideIcon; title: string; hint: string; done?: boolean | undefined; children?: React.ReactNode }) {
  return (
    <div className="surface-card flex flex-col p-6">
      <div className="flex items-start gap-4">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
          {done ? <Check className="size-5" strokeWidth={1.5} /> : <Icon className="size-5" strokeWidth={1.5} />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-2xl text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{done ? "Done — thank you." : hint}</p>
        </div>
      </div>
      {children}
      <Button asChild variant={done ? "ghost" : "default"} className="mt-5 self-start rounded-full">
        <Link to={to}>{done ? "Add another" : title}</Link>
      </Button>
    </div>
  );
}
