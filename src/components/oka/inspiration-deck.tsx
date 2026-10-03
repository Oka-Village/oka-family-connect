import { useState } from "react";

import { DeckCard } from "@/components/oka/deck-card";
import { FavoriteButton } from "@/components/oka/favorite-button";
import { cardKey } from "@/hooks/use-favorites";
import { INSPIRATION_QUOTES } from "@/lib/home-content";

function nextIndex(previous: number | null, length: number) {
  if (length < 2) return 0;
  let next = Math.floor(Math.random() * length);
  if (next === previous) next = (next + 1) % length;
  return next;
}

export function InspirationDeck() {
  const [index, setIndex] = useState<number | null>(null);
  const draw = () => setIndex((current) => nextIndex(current, INSPIRATION_QUOTES.length));
  const item = index === null ? null : INSPIRATION_QUOTES[index];
  return (
    <section aria-labelledby="inspiration-title" className="home-space-panel inspiration-panel">
      <div className="max-w-lg">
        <p className="section-label">A spark for today</p>
        <h2 id="inspiration-title" className="mt-4 text-4xl text-foreground sm:text-5xl">Inspiration</h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">A small light, offered at random.</p>
      </div>
      <DeckCard variant="inspiration" revealed={item !== null} onDraw={draw} action={item ? <FavoriteButton type="inspiration" itemRef={cardKey(`${item.quote}|${item.author}`)} snapshot={{ text: item.quote, author: item.author }} /> : null}>
        <p className="font-serif text-3xl leading-tight text-foreground">“{item?.quote ?? "Something bright is waiting."}”</p>
        {item && <p className="section-label mt-6">{item.author}</p>}
      </DeckCard>
    </section>
  );
}