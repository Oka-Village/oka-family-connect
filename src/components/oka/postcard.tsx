import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TapeColor = "sand" | "sage" | "terracotta";
export type SpaceId = "reflection" | "inspiration" | "appreciation";

export const SPACE_ART: Record<SpaceId, string> = {
  reflection: "/home/reflection.svg",
  inspiration: "/home/inspiration.svg",
  appreciation: "/home/appreciation.svg",
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const postmarkDate = (d = new Date()) => `${d.getDate()} · ${ROMAN[d.getMonth()]}`;
export const longDate = (d = new Date()) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).replace(",", "");

/** Paper card with grain and washi tape. Square corners, slight rotation. */
export function Postcard({ rotate = 0, translateY = 0, tape, tapeRotate = 3, className, style, children }: {
  rotate?: number | undefined; translateY?: number | undefined; tape?: TapeColor | undefined; tapeRotate?: number | undefined; className?: string | undefined; style?: CSSProperties | undefined; children: ReactNode;
}) {
  return (
    <div className={cn("postcard", className)} style={{ "--r": `${rotate}deg`, "--ty": `${translateY}px`, ...style } as CSSProperties}>
      <span className="postcard-grain" aria-hidden />
      {tape && <span className="postcard-tape" aria-hidden style={{ background: `var(--tape-${tape})`, "--tape-r": `${tapeRotate}deg` } as CSSProperties} />}
      <div className="relative">{children}</div>
    </div>
  );
}

export function Postmark({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div className="flex size-[124px] shrink-0 -rotate-[10deg] flex-col items-center justify-center rounded-full border-[1.5px] border-postcard-rule text-center" aria-hidden>
      <span className="max-w-[96px] truncate text-[10px] uppercase tracking-[0.2em] text-postcard-label">{top}</span>
      <span className="font-serif text-[26px] leading-tight text-foreground">{postmarkDate()}</span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-postcard-label">{bottom}</span>
    </div>
  );
}

export function Stamp({ space }: { space: SpaceId }) {
  return (
    <div className="h-[184px] w-[150px] shrink-0 border-2 border-dashed border-postcard-rule bg-postcard-inner p-2" aria-hidden>
      <img src={SPACE_ART[space]} alt="" className="size-full object-cover" />
    </div>
  );
}

/** Address side of a postcard back: postmark + stamp, then three address lines. */
export function AddressSide({ space, postmark, lines }: { space: SpaceId; postmark: { top: string; bottom: string }; lines: [ReactNode, ReactNode] }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-4 max-md:origin-top max-md:scale-[0.7] max-md:-mb-16"><Postmark {...postmark} /><Stamp space={space} /></div>
      <div className="mt-5 flex flex-col gap-5">
        {lines.map((line, i) => <p key={i} className="min-h-[47px] truncate border-b border-postcard-rule pb-2 font-serif text-[26px] italic text-foreground">{line}</p>)}
        <span className="h-[34px] border-b border-postcard-rule" aria-hidden />
      </div>
    </div>
  );
}

/** Message side | rule | address side. Stacks with the address first on phones. */
export function PostcardBack({ message, address }: { message: ReactNode; address: ReactNode }) {
  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-8 p-6 md:h-[600px] md:grid-cols-[1fr_1px_340px] md:gap-10 md:px-[52px] md:py-12">
      <div className="order-3 flex min-h-0 flex-col md:order-1">{message}</div>
      <span className="order-2 h-px w-full bg-postcard-rule md:h-auto md:w-px" aria-hidden />
      <div className="order-1 md:order-3">{address}</div>
    </div>
  );
}

/** Shared shell for the three space pages. */
export function SpaceShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-9 px-5 py-10 md:px-[90px] md:pb-[72px] md:pt-14">
      <div className="flex items-baseline justify-between gap-4">
        <Link to="/home" className="text-sm text-brown-label hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">← Home</Link>
        <p className="section-label text-right">{label}</p>
      </div>
      {children}
    </div>
  );
}

export const pillPrimary = "pill bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
export const pillSecondary = "pill bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
export const pillOutline = "pill border border-sand text-foreground hover:bg-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Shared favorite action used on Reflection and Inspiration so wording and styling stay identical. */
export function CollectionButton({ saved, disabled, onClick }: { saved: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cn(pillOutline, "inline-flex items-center justify-center gap-2")} disabled={disabled} aria-pressed={saved} onClick={onClick}>
      <Heart className={cn("h-4 w-4 text-primary transition-transform motion-safe:duration-200", saved && "fill-primary motion-safe:scale-110")} strokeWidth={1.5} aria-hidden="true" />
      {saved ? "Remove from my collection" : "Save to my collection"}
    </button>
  );
}
