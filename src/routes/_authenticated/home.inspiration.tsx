import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { CollectionButton, Postcard, SPACE_ART, SpaceShell, pillOutline, pillSecondary } from "@/components/oka/postcard";
import { cardKey, useFavorites } from "@/hooks/use-favorites";
import { INSPIRATION_QUOTES } from "@/lib/home-content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home/inspiration")({
  head: () => ({ meta: [
    { title: "Inspiration — Oka" },
    { name: "description", content: "A small spark from a timeless voice, on a watercolour postcard." },
    { property: "og:title", content: "Inspiration — Oka" },
    { property: "og:description", content: "A small spark from a timeless voice, on a watercolour postcard." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: InspirationPage,
});

const SEED = Math.max(0, INSPIRATION_QUOTES.findIndex((q) => q.quote.startsWith("If you want to go fast")));

function randomIndex(previous: number) {
  const n = INSPIRATION_QUOTES.length;
  let next = Math.floor(Math.random() * n);
  if (n > 1 && next === previous) next = (next + 1) % n;
  return next;
}

function InspirationPage() {
  const [index, setIndex] = useState(SEED);
  const [flipping, setFlipping] = useState(false);
  const timer = useRef<number | null>(null);
  const { isFavorite, toggle } = useFavorites();
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const item = INSPIRATION_QUOTES[index]!;
  const ref = cardKey(`${item.quote}|${item.author}`);
  const pinned = isFavorite("inspiration", ref);

  function draw() {
    if (flipping) return;
    setFlipping(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => { setIndex((i) => randomIndex(i)); setFlipping(false); }, reduced ? 250 : 350);
  }

  async function share() {
    const text = `“${item.quote}” — ${item.author}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast.success("Copied. Paste it wherever your friend is."); }
    } catch { /* closed share sheet */ }
  }

  return (
    <SpaceShell label="Inspiration · A spark for today">
      <div className="postcard-scene">
        <Postcard rotate={0.5} className={cn("postcard-arrive max-md:[--r:0.3deg]", flipping && "postcard-flip-out")} style={{ boxShadow: "var(--postcard-shadow-big)" }}>
          <div className="grid grid-cols-1 items-center gap-8 p-4 md:h-[600px] md:grid-cols-[minmax(0,560px)_1fr] md:gap-[52px] md:py-7 md:pl-7 md:pr-14">
            <div className="aspect-[320/220] bg-postcard-inner md:aspect-auto md:h-[544px]"><img src={SPACE_ART.inspiration} alt="" className="size-full object-contain" /></div>
            <div className="px-2 pb-6 md:p-0" aria-live="polite">
              <p className="font-serif text-[34px] italic leading-[1.08] text-foreground md:text-[52px]">“{item.quote}”</p>
              <p className="mt-6 text-[15px] text-postcard-muted">{item.author}</p>
            </div>
          </div>
        </Postcard>
      </div>
      <div className="flex w-full flex-col items-stretch justify-center gap-3 md:flex-row md:items-center">
        <CollectionButton saved={pinned} onClick={() => toggle("inspiration", ref, { text: item.quote, author: item.author })} />
        <button type="button" className={pillSecondary} onClick={draw}>Draw another card</button>
        <button type="button" className={pillOutline} onClick={() => void share()}>Send to a friend</button>
      </div>
    </SpaceShell>
  );
}
