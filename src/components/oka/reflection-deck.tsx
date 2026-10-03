import { useState } from "react";

import { DeckCard } from "@/components/oka/deck-card";
import { FavoriteButton } from "@/components/oka/favorite-button";
import { cardKey } from "@/hooks/use-favorites";
import { REFLECTION_QUESTIONS } from "@/lib/home-content";

function nextIndex(previous: number | null, length: number) {
  if (length < 2) return 0;
  let next = Math.floor(Math.random() * length);
  if (next === previous) next = (next + 1) % length;
  return next;
}

export function ReflectionDeck() {
  const [index, setIndex] = useState<number | null>(null);
  const draw = () => setIndex((current) => nextIndex(current, REFLECTION_QUESTIONS.length));
  return (
    <section aria-labelledby="reflection-title" className="home-space-panel reflection-panel">
      <div className="max-w-lg">
        <p className="section-label">A quiet pause</p>
        <h2 id="reflection-title" className="mt-4 text-4xl text-foreground sm:text-5xl">Reflection</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">Draw a question. Sit with it for as long as it needs.</p>
      </div>
      <DeckCard variant="reflection" revealed={index !== null} onDraw={draw} action={index !== null ? <FavoriteButton type="reflection" itemRef={cardKey(REFLECTION_QUESTIONS[index])} snapshot={{ text: REFLECTION_QUESTIONS[index] }} /> : null}>
        <p className="section-label text-primary">For reflection</p>
        <p className="mt-5 font-serif text-3xl leading-tight text-foreground">{index === null ? "Your question is waiting." : REFLECTION_QUESTIONS[index]}</p>
      </DeckCard>
    </section>
  );
}