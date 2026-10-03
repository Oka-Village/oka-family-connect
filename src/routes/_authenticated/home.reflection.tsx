import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AddressSide, CollectionButton, Postcard, PostcardBack, SpaceShell, longDate, pillPrimary, pillSecondary } from "@/components/oka/postcard";
import { cardKey, useFavorites } from "@/hooks/use-favorites";
import { REFLECTION_MAX, useReflections, useSaveReflection } from "@/hooks/use-reflections";
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
  const { isFavorite, toggle } = useFavorites();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const save = useSaveReflection();
  const { data: reflections } = useReflections();
  const count = reflections?.length ?? 0;
  useEffect(() => { setIndex(randomIndex(null)); return () => { if (timer.current) window.clearTimeout(timer.current); }; }, []);

  const question = index === null ? null : REFLECTION_QUESTIONS[index] ?? null;
  const ref = question ? cardKey(question) : "";
  const kept = question ? isFavorite("reflection", ref) : false;

  function draw() {
    if (flipping) return;
    setFlipping(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => { setIndex((i) => randomIndex(i)); setFlipping(false); }, reduced ? 250 : 350);
  }

  async function saveReflection() {
    const body = text.trim();
    if (!question || !body || save.isPending) return;
    setStatus(null);
    try {
      await save.mutateAsync({ question, body });
      setText("");
      setStatus({ ok: true, msg: "Saved. It's yours alone." });
    } catch {
      setStatus({ ok: false, msg: "We couldn't save that just now. Your words are still here — please try again." });
    }
  }

  return (
    <SpaceShell label={`Reflection · ${longDate()}`}>
      <div className="postcard-scene">
        <Postcard rotate={-0.5} className={cn("postcard-arrive max-md:[--r:-0.3deg]", flipping && "postcard-flip-out")} style={{ boxShadow: "var(--postcard-shadow-big)" }}>
          <PostcardBack
            message={<>
              <p className="font-serif text-[34px] leading-[1.02] text-foreground md:text-[50px]" aria-live="polite">{question ?? "\u00a0"}</p>
              <label htmlFor="reflection-body" className="sr-only">Your reflection</label>
              <textarea
                id="reflection-body"
                value={text}
                maxLength={REFLECTION_MAX}
                onChange={(e) => { setText(e.target.value); if (status) setStatus(null); }}
                placeholder="Write a few words, just for you…"
                className="postcard-ruled mt-6 min-h-[168px] w-full flex-1 resize-none border-0 bg-transparent p-0 font-serif text-[22px] italic leading-[42px] text-foreground placeholder:text-postcard-label focus:outline-none focus-visible:ring-0"
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground" aria-hidden="true">{text.length} / {REFLECTION_MAX}</p>
            </>}
            address={<AddressSide space="reflection" postmark={{ top: "Kept", bottom: "At dusk" }} lines={["To: myself,", "a little later"]} />}
          />
        </Postcard>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row md:items-center">
          <button type="button" className={pillPrimary} disabled={!question || !text.trim() || save.isPending} onClick={() => void saveReflection()}>{save.isPending ? "Saving…" : "Save reflection"}</button>
          <CollectionButton saved={kept} disabled={!question} onClick={() => question && toggle("reflection", ref, { text: question })} />
          <button type="button" className={pillSecondary} onClick={draw}>Draw another card</button>
        </div>
        <p role="status" aria-live="polite" className={cn("min-h-5 text-sm", status?.ok ? "text-sage" : "text-destructive")}>{status?.msg ?? ""}</p>
        <p className="text-[13px] text-muted-foreground">{count} {count === 1 ? "reflection" : "reflections"} saved. Private.</p>
        <Link to="/home/reflection/past" className="text-sm text-primary underline-offset-4 hover:underline">Past reflections</Link>
      </div>
    </SpaceShell>
  );
}
