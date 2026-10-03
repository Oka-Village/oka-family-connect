import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { Postcard, SPACE_ART, type SpaceId, type TapeColor } from "@/components/oka/postcard";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const spaceSchema = z.object({
  space: fallback(z.enum(["reflection", "inspiration", "appreciation"]).optional(), undefined),
  t: fallback(z.string().optional(), undefined),
  demo: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/home/")({
  validateSearch: zodValidator(spaceSchema),
  beforeLoad: ({ search }) => {
    // Old /home?space=… links now open the space's own page.
    if (search.space === "reflection") throw redirect({ to: "/home/reflection" });
    if (search.space === "inspiration") throw redirect({ to: "/home/inspiration" });
    if (search.space === "appreciation") throw redirect({ to: "/home/appreciation", search: { t: search.t, demo: search.demo } });
  },
  head: () => ({ meta: [
    { title: "Home — Oka" },
    { name: "description", content: "Three postcards each morning: a reflection, an inspiration, and a note of appreciation." },
    { property: "og:title", content: "Home — Oka" },
    { property: "og:description", content: "Three postcards each morning: a reflection, an inspiration, and a note of appreciation." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HomePage,
});

const CARDS: Array<{ id: SpaceId; title: string; sub: string; rotate: number; ty: number; tape: TapeColor; tapeRotate: number }> = [
  { id: "reflection", title: "Reflection", sub: "A question to carry into the day.", rotate: -2.2, ty: 0, tape: "sand", tapeRotate: 3 },
  { id: "inspiration", title: "Inspiration", sub: "A small spark from a timeless voice.", rotate: 1.4, ty: -14, tape: "sage", tapeRotate: -2 },
  { id: "appreciation", title: "Appreciation", sub: "A note of thanks for someone in the family.", rotate: -1, ty: 0, tape: "terracotta", tapeRotate: 4 },
];

const TO = { reflection: "/home/reflection", inspiration: "/home/inspiration", appreciation: "/home/appreciation" } as const;

function HomePage() {
  const { data: profile, isLoading, isError } = useProfile();
  const navigate = useNavigate();
  const [flipping, setFlipping] = useState<SpaceId | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];

  const unread = useQuery({
    queryKey: ["appreciation-unread", profile?.id ?? null],
    enabled: Boolean(profile),
    queryFn: async () => {
      const { count, error } = await supabase.from("appreciation_letters").select("id", { count: "exact", head: true }).eq("recipient_id", profile!.id).is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const unreadCount = unread.data ?? 0;

  function open(id: SpaceId) {
    if (flipping) return;
    setFlipping(id);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => void navigate({ to: TO[id] }), reduced ? 250 : 350);
  }

  return (
    <div className="postcard-settle mx-auto flex max-w-[1280px] flex-col gap-12 px-5 pb-20 pt-12 md:gap-16 md:px-12 md:pt-[84px] lg:px-24">
      <header className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="section-label">Your place in Oka</p>
          <h1 className="mt-3 font-serif text-[64px] leading-[0.9] tracking-[-0.02em] text-foreground md:text-[104px]">Home</h1>
          {isLoading ? <Skeleton className="mt-4 h-9 w-72" /> : <p className="mt-2.5 font-serif text-[28px] text-foreground md:text-[34px]">{isError ? "Welcome home." : `Welcome home${firstName ? `, ${firstName}` : ""}.`}</p>}
          <p className="mt-3 max-w-[620px] text-[17px] leading-[1.6] text-muted-foreground">A quiet corner to pause, gather a little light, or let someone know they matter.</p>
        </div>
        <p className="font-serif text-xl italic text-postcard-label md:text-right">Three cards arrived<br />this morning.</p>
      </header>

      <div className="postcard-scene flex flex-col items-center pb-5 pt-2.5 md:flex-row md:flex-wrap md:justify-center md:gap-11">
        {CARDS.map((card, i) => (
          <button
            key={card.id}
            type="button"
            onClick={() => open(card.id)}
            aria-label={`Open ${card.title}${card.id === "appreciation" && unreadCount ? `, ${unreadCount} unread` : ""}`}
            className={cn("group w-[92%] text-left focus-visible:outline-none md:w-[340px]", i > 0 && "max-md:-mt-6", flipping && flipping !== card.id && "postcard-fade-out", flipping === card.id && "postcard-flip-out")}
            style={{ transition: "opacity 300ms ease-out", zIndex: flipping === card.id ? 10 : undefined }}
          >
            <Postcard rotate={card.rotate} translateY={card.ty} tape={card.tape} tapeRotate={card.tapeRotate} className="postcard-lift px-3.5 pb-7 pt-3.5 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-4" style={card.id === "inspiration" ? { boxShadow: "0 22px 46px rgb(55 44 36 / .18)" } : undefined}>
              <div className="h-[216px] bg-postcard-inner"><img src={SPACE_ART[card.id]} alt="" className="size-full object-contain" /></div>
              <div className="flex flex-col gap-2 px-2 pt-5">
                <span className="font-serif text-[38px] leading-none text-foreground">{card.title}</span>
                <span className="text-sm leading-[1.55] text-postcard-muted">{card.sub}</span>
              </div>
              {card.id === "appreciation" && unreadCount > 0 && (
                <span className="absolute -right-2.5 -top-2.5 z-10 flex size-[30px] items-center justify-center rounded-full text-[13px] font-medium text-primary-foreground shadow-[0_3px_8px_rgb(55_44_36/0.25)]" style={{ background: "var(--wax-badge)" }} aria-hidden>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </Postcard>
          </button>
        ))}
      </div>

      <p className="border-t border-sand pt-8 text-center font-serif text-[28px] text-foreground md:text-4xl">Choose a space when you’re ready.</p>
    </div>
  );
}
