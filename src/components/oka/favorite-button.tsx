import { Heart } from "lucide-react";

import { useFavorites, type FavoriteSnapshot, type FavoriteType } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

type Props = { type: FavoriteType; itemRef: string; snapshot?: FavoriteSnapshot; className?: string };

/** Heart toggle that saves an item to Collections. 44px touch target. */
export function FavoriteButton({ type, itemRef, snapshot, className }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const saved = isFavorite(type, itemRef);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from Collections" : "Save to Collections"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(type, itemRef, snapshot); }}
      className={cn("favorite-btn inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
    >
      <Heart key={String(saved)} className={cn("size-5 text-primary", saved && "favorite-pop fill-primary")} strokeWidth={1.5} />
    </button>
  );
}
