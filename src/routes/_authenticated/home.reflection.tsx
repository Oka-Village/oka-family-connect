import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AddressSide, Postcard, PostcardBack, SpaceShell, longDate, pillPrimary, pillSecondary } from "@/components/oka/postcard";
import { cardKey, useFavorites } from "@/hooks/use-favorites";
import { REFLECTION_QUESTIONS } from "@/lib/home-content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home/reflection")({
  head: () => ({ meta: [
    { title: "Reflection — Oka" },
    { name: "description", content: "A question to carry into the day, written on the back of a postcard." },
    { property: "og:title", content: "Reflection — Oka" },
    { property: "og:description", content: "A question to carry into the day, written on the back of a postcard." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ReflectionPage,
});

function randomIndex(previous: number | null) {
  const n = REFLECTION_QUESTIONS.length;
  let next = Math.floor(Math.random() * n);
  if (n > 1 && next === previous) next = (next + 1) % n;
  return next;
}

function ReflectionPage() {
  const [index, setIndex] = useState<number | null>(null);
  const [flipping, setFlipping] = useState(false);
  const timer = useRef<number | null>(null);
  const { favorites, isFavorite, toggle } = useFavorites();
  useEffect(() => { setIndex(randomIndex(null)); return () => { if (timer.current) window.clearTimeout(timer.current); }; }, []);

  const question = index === null ? null : REFLECTION_QUESTIONS[index] ?? null;
  const ref = question ? cardKey(question) : "";
  const kept = question ? isFavorite("reflection", ref) : false;
  const keptCount = favorites.filter((f) => f.item_type === "reflection").length;

  function draw() {
    if (flipping) return;
    setFlipping(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => { setIndex((i) => randomIndex(i)); setFlipping(false); }, reduced ? 250 : 350);
  }

  return (
    <SpaceShell label={`Reflection · ${longDate()}`}>
      <div className="postcard-scene">
        <Postcard rotate={-0.5} className={cn("postcard-arrive max-md:[--r:-0.3deg]", flipping && "postcard-flip-out")} style={{ boxShadow: "var(--postcard-shadow-big)" }}>
          <PostcardBack
            message={<>
              <p className="font-serif text-[34px] leading-[1.02] text-foreground md:text-[50px]" aria-live="polite">{question ?? "\u00a0"}</p>
              <div className="postcard-ruled mt-6 min-h-[168px] flex-1 font-serif text-[22px] italic text-postcard-label">Sit with it for as long as it needs.</div>
            </>}
            address={<AddressSide space="reflection" postmark={{ top: "Kept", bottom: "At dusk" }} lines={["To: myself,", "a little later"]} />}
          />
        </Postcard>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row md:items-center">
          <button type="button" className={pillPrimary} disabled={!question} aria-pressed={kept} onClick={() => question && toggle("reflection", ref, { text: question })}>{kept ? "Kept in your collection" : "Keep this card"}</button>
          <button type="button" className={pillSecondary} onClick={draw}>Draw another card</button>
        </div>
        <p className="text-[13px] text-muted-foreground">Private. {keptCount} {keptCount === 1 ? "card" : "cards"} kept so far.</p>
        <Link to="/collections" search={{ tab: "reflection" }} className="text-sm text-primary underline-offset-4 hover:underline">Your kept cards</Link>
      </div>
    </SpaceShell>
  );
}
