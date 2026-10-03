import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/oka/wordmark";
import { cn } from "@/lib/utils";

type DeckCardProps = {
  variant: "reflection" | "inspiration";
  revealed: boolean;
  children: React.ReactNode;
  onDraw: () => void;
};

export function DeckCard({ variant, revealed, children, onDraw }: DeckCardProps) {
  return (
    <div className={cn("deck-scene mx-auto", variant === "reflection" ? "deck-scene-reflection" : "deck-scene-inspiration")}>
      <button type="button" className={cn("deck-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4", revealed && "is-revealed")} onClick={onDraw} aria-label={revealed ? "Draw another card" : "Draw a card"}>
        <span className="deck-card-inner">
          <span className="deck-face deck-back" aria-hidden={revealed}>
            <span className="deck-pattern" />
            <Wordmark className="relative h-10" />
          </span>
          <span className="deck-face deck-front">{children}</span>
        </span>
      </button>
      <Button className="mt-7 rounded-full px-7" onClick={onDraw}>{revealed ? "Draw another" : "Draw a card"}</Button>
    </div>
  );
}