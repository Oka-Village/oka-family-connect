import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BandTone = "forest" | "fire" | "water" | "earth" | "sun";

type Props = {
  tone: BandTone;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function HeaderBand({ tone, eyebrow, title, lead, className, children }: Props) {
  return (
    <div className={cn("pods-band", `pods-band-${tone}`, className)}>
      <div className="pods-wrap">
        <p className="pods-eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-[40px] font-medium leading-[44px] text-balance">
          {title}
        </h1>
        {lead ? (
          <p className="mt-2 max-w-[60ch] text-[17px] leading-[27px] opacity-95">{lead}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
