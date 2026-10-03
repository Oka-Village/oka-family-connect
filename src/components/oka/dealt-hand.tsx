import { useMemo, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DealtHandProps<T> = {
  items: T[];
  itemKey: (item: T) => string;
  label: string;
  title: ReactNode;
  description: string;
  secondaryAction?: ReactNode;
  renderCard: (item: T, front: boolean) => ReactNode;
};

/** The shared, tactile recommendation moment on Oka's four discovery pages. */
export function DealtHand<T>({ items, itemKey, label, title, description, secondaryAction, renderCard }: DealtHandProps<T>) {
  const [offset, setOffset] = useState(0);
  const [dealing, setDealing] = useState(false);
  const touchStart = useRef<number | null>(null);
  const picks = useMemo(() => {
    if (!items.length) return [];
    return Array.from({ length: Math.min(3, items.length) }, (_, i) => items[(offset + i) % items.length]).filter(Boolean) as T[];
  }, [items, offset]);

  function shuffle(step = 3) {
    if (items.length < 2 || dealing) return;
    setDealing(true);
    window.setTimeout(() => {
      setOffset((current) => (current + step) % items.length);
      setDealing(false);
    }, 260);
  }

  function promote(index: number) {
    if (index === 1 || dealing || !picks[index]) return;
    shuffle(index === 0 ? Math.max(items.length - 1, 1) : 1);
  }

  return (
    <section className="dealt-hero">
      <div className="dealt-copy">
        <p className="section-label">{label}</p>
        <h1 className="dealt-title">{title}</h1>
        <p className="dealt-description">{description}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-full px-6" onClick={() => shuffle()} disabled={items.length < 2 || dealing}>
            <RefreshCw className={cn("size-4", dealing && "animate-spin")} strokeWidth={1.5} /> Shuffle
          </Button>
          {secondaryAction}
        </div>
      </div>

      <div
        className={cn("dealt-stage", dealing && "is-dealing")}
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          const end = event.changedTouches[0]?.clientX;
          if (touchStart.current != null && end != null && Math.abs(end - touchStart.current) > 45) shuffle(end < touchStart.current ? 1 : Math.max(items.length - 1, 1));
          touchStart.current = null;
        }}
      >
        {picks.map((item, index) => (
          <div
            key={`${itemKey(item)}-${offset}`}
            className={cn("dealt-card", `dealt-card-${index}`)}
            role={index === 1 ? undefined : "button"}
            tabIndex={index === 1 ? undefined : 0}
            onClick={() => promote(index)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") promote(index); }}
          >
            {renderCard(item, index === 1)}
          </div>
        ))}
      </div>
    </section>
  );
}