import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, CalendarDays, Home, Loader2, MapPin, Sparkles } from "lucide-react";

import { MemberAvatar, ProfileSections } from "@/components/oka/profile-sections";
import { resolvePhotoUrl } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { formatEventDate, formatEventTime } from "@/lib/events";
import type { OkaProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/members/$memberId")({
  head: () => ({
    meta: [
      { title: "Member — Oka" },
      { name: "description", content: "A member of the Oka family." },
      { property: "og:title", content: "Member — Oka" },
      { property: "og:description", content: "A member of the Oka family." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemberPage,
});

function MemberPage() {
  const { memberId } = Route.useParams();
  const q = useQuery({
    queryKey: ["member", memberId],
    queryFn: async () => {
      const [p, skills, houses, events] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", memberId).maybeSingle(),
        supabase.from("skills").select("id,title,category,format").eq("owner_id", memberId).eq("status", "published").order("created_at", { ascending: false }).limit(12),
        supabase.from("houses").select("id,title,location_text,property_type").eq("owner_id", memberId).eq("status", "published").order("created_at", { ascending: false }).limit(12),
        supabase.from("events").select("id,title,starts_at,timezone").eq("host_id", memberId).eq("status", "published").gte("starts_at", new Date().toISOString()).order("starts_at").limit(10),
      ]);
      if (p.error) throw p.error;
      const profile = p.data as OkaProfile | null;
      return {
        profile,
        photo: profile ? await resolvePhotoUrl(profile.photo_url) : null,
        skills: skills.data ?? [],
        houses: houses.data ?? [],
        events: events.data ?? [],
      };
    },
  });

  if (q.isLoading) return <div className="flex justify-center py-24"><Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.5} /></div>;
  const d = q.data;
  if (!d?.profile) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="section-label">Members</p>
        <h1 className="mt-4 text-3xl">We couldn't find this member</h1>
        <Link to="/directory" className="mt-6 inline-block text-primary">Back to members</Link>
      </div>
    );
  }
  const p = d.profile;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <Link to="/directory" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> Members
      </Link>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <MemberAvatar src={d.photo} name={p.display_name} className="size-28" />
        <div>
          <p className="section-label">Member</p>
          <h1 className="mt-2 text-4xl text-foreground lg:text-5xl">{p.display_name ?? "Oka member"}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {p.location && <span className="flex items-center gap-1"><MapPin className="size-4 text-primary" strokeWidth={1.5} />{p.location}</span>}
            {p.profession && <span className="flex items-center gap-1"><Briefcase className="size-4 text-primary" strokeWidth={1.5} />{p.profession}</span>}
          </div>
        </div>
      </div>

      <div className="mt-10"><ProfileSections profile={p} /></div>

      <section className="surface-card mt-6 p-6">
        <p className="section-label flex items-center gap-2"><CalendarDays className="size-4 text-primary" strokeWidth={1.5} />Upcoming gatherings they host</p>
        {d.events.length ? (
          <ul className="mt-4 divide-y divide-border">
            {d.events.map((e) => (
              <li key={e.id}>
                <Link to="/events/$eventId" params={{ eventId: e.id }} className="flex flex-wrap items-baseline justify-between gap-2 py-3 hover:text-primary">
                  <span className="font-serif text-xl">{e.title}</span>
                  <span className="text-sm text-muted-foreground">{formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 text-sm text-muted-foreground">Nothing on the calendar right now.</p>}
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="surface-card p-6">
          <p className="section-label flex items-center gap-2"><Sparkles className="size-4 text-primary" strokeWidth={1.5} />Skills they offer</p>
          {d.skills.length ? (
            <ul className="mt-4 space-y-2">{d.skills.map((s) => <li key={s.id}><Link to="/skills" className="hover:text-primary">{s.title}</Link></li>)}</ul>
          ) : <p className="mt-4 text-sm text-muted-foreground">No skills shared yet.</p>}
        </section>
        <section className="surface-card p-6">
          <p className="section-label flex items-center gap-2"><Home className="size-4 text-primary" strokeWidth={1.5} />Homes they open</p>
          {d.houses.length ? (
            <ul className="mt-4 space-y-2">{d.houses.map((h) => <li key={h.id}><Link to="/houses" className="hover:text-primary">{h.title}{h.location_text ? ` — ${h.location_text}` : ""}</Link></li>)}</ul>
          ) : <p className="mt-4 text-sm text-muted-foreground">No homes shared yet.</p>}
        </section>
      </div>
    </div>
  );
}
