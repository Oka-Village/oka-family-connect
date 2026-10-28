import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, CalendarDays, Home, Loader2, MapPin, Pencil, Sparkles } from "lucide-react";

import { AdminEditProfile } from "@/components/oka/admin-member-tools";
import { Postcard } from "@/components/oka/postcard";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/hooks/use-is-admin";
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
  const roles = useRoles();
  const [editing, setEditing] = useState(false);
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
        <h1 className="mt-4 font-serif text-3xl">We couldn't find this member</h1>
        <Link to="/directory" className="mt-6 inline-block text-primary">Back to members</Link>
      </div>
    );
  }
  const p = d.profile;
  const firstName = (p.display_name ?? "This member").split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 md:px-6 md:py-14">
      <Link to="/directory" className="inline-flex items-center gap-2 text-sm text-brown-label hover:text-foreground">
        <ArrowLeft className="size-4 text-primary" strokeWidth={1.5} /> Members
      </Link>

      {/* Member header — a paper card with washi tape, like a postcard from the family. */}
      <Postcard tape="sand" rotate={-0.6} className="mt-6 p-6 md:p-10">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
          <MemberAvatar src={d.photo} name={p.display_name} className="size-28 ring-4 ring-postcard-inner md:size-32" />
          <div className="min-w-0">
            <p className="section-label">Member of the family</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight text-foreground md:text-5xl">{p.display_name ?? "Oka member"}</h1>
            <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground sm:justify-start">
              {p.location && <span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary" strokeWidth={1.5} />{p.location}</span>}
              {p.profession && <span className="flex items-center gap-1.5"><Briefcase className="size-4 text-primary" strokeWidth={1.5} />{p.profession}</span>}
            </div>
          </div>
        </div>

        {roles.data?.isAdmin && (
          <div className="mt-6 border-t border-postcard-rule pt-5">
            {editing ? <AdminEditProfile key={memberId} userId={memberId} onDone={() => setEditing(false)} /> : (
              <Button variant="outline" className="rounded-full" onClick={() => setEditing(true)}><Pencil className="size-4 text-primary" strokeWidth={1.5} />Edit profile</Button>
            )}
          </div>
        )}
      </Postcard>

      <div className="mt-8"><ProfileSections profile={p} /></div>

      {/* Gatherings */}
      <section className="surface-card mt-6 p-6 md:p-8">
        <p className="section-label flex items-center gap-2"><CalendarDays className="size-4 text-primary" strokeWidth={1.5} />Gatherings {firstName} hosts</p>
        {d.events.length ? (
          <ul className="mt-5 divide-y divide-border">
            {d.events.map((e) => (
              <li key={e.id}>
                <Link to="/events/$eventId" params={{ eventId: e.id }} className="group flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3.5">
                  <span className="font-serif text-xl text-foreground transition-colors group-hover:text-primary">{e.title}</span>
                  <span className="text-sm text-muted-foreground">{formatEventDate(e.starts_at, e.timezone)} · {formatEventTime(e.starts_at, e.timezone)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 border-l-2 border-sand pl-4 font-serif text-lg italic text-muted-foreground">Nothing on the calendar right now — {firstName} may be dreaming up the next one.</p>
        )}
      </section>

      {/* Skills & homes */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="surface-card p-6 md:p-8">
          <p className="section-label flex items-center gap-2"><Sparkles className="size-4 text-primary" strokeWidth={1.5} />Skills {firstName} offers</p>
          {d.skills.length ? (
            <ul className="mt-5 space-y-3">
              {d.skills.map((s) => (
                <li key={s.id}>
                  <Link to="/skills" className="group flex items-start gap-3 rounded-2xl border border-sand/70 bg-postcard-inner/50 px-4 py-3 transition-colors hover:border-primary/40">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
                    <span className="min-w-0">
                      <span className="block font-serif text-lg leading-snug text-foreground transition-colors group-hover:text-primary">{s.title}</span>
                      {(s.category || s.format) && <span className="mt-0.5 block text-xs uppercase tracking-widest text-muted-foreground">{[s.category, s.format].filter(Boolean).join(" · ")}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 border-l-2 border-sand pl-4 font-serif text-lg italic text-muted-foreground">{firstName} hasn't shared a skill yet — every gift arrives in its own time.</p>
          )}
        </section>

        <section className="surface-card p-6 md:p-8">
          <p className="section-label flex items-center gap-2"><Home className="size-4 text-primary" strokeWidth={1.5} />Homes {firstName} opens</p>
          {d.houses.length ? (
            <ul className="mt-5 space-y-3">
              {d.houses.map((h) => (
                <li key={h.id}>
                  <Link to="/houses" className="group flex items-start gap-3 rounded-2xl border border-sand/70 bg-postcard-inner/50 px-4 py-3 transition-colors hover:border-primary/40">
                    <Home className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
                    <span className="min-w-0">
                      <span className="block font-serif text-lg leading-snug text-foreground transition-colors group-hover:text-primary">{h.title}</span>
                      {(h.location_text || h.property_type) && <span className="mt-0.5 block text-xs uppercase tracking-widest text-muted-foreground">{[h.location_text, h.property_type?.replace(/_/g, " ").toLowerCase()].filter(Boolean).join(" · ")}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 border-l-2 border-sand pl-4 font-serif text-lg italic text-muted-foreground">No home shared yet — the door may open when the moment is right.</p>
          )}
        </section>
      </div>
    </div>
  );
}
