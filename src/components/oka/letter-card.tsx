import { formatDistanceToNow } from "date-fns";

import { Postcard, type TapeColor } from "@/components/oka/postcard";
import type { AppreciationLetter } from "@/lib/appreciation";

const TILTS = [-1.6, 1.2, -0.6, 1.8, -1.1, 0.7];
const TAPES: TapeColor[] = ["sand", "sage", "terracotta"];

/** A received or sent note, shown as a small postcard in a loose stack. */
export function LetterCard({ letter, kind, index = 0, onOpen }: { letter: AppreciationLetter; kind: "received" | "sent"; index?: number; onOpen?: () => void }) {
  const unread = kind === "received" && !letter.read_at;
  const name = letter.person?.display_name ?? "an Oka member";
  return (
    <article
      onClick={onOpen}
      onFocus={onOpen}
      onKeyDown={(event) => { if (onOpen && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(); } }}
      tabIndex={unread ? 0 : undefined}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Postcard rotate={TILTS[index % TILTS.length]} tape={TAPES[index % TAPES.length]} tapeRotate={index % 2 ? -2 : 3} className="postcard-lift px-6 pb-5 pt-7">
        {unread && <span className="absolute -right-2 -top-2 z-10 size-4 rounded-full" style={{ background: "var(--wax-badge)" }} aria-label="Unread" />}
        <p className="font-serif text-[21px] italic leading-snug text-foreground">“{letter.body}”</p>
        <p className="mt-4 text-xs text-postcard-label">{kind === "received" ? "From" : "To"} {name}{letter.person?.location ? ` · ${letter.person.location}` : ""}</p>
        <p className="mt-0.5 text-xs text-postcard-muted">{formatDistanceToNow(new Date(letter.created_at), { addSuffix: true })}</p>
      </Postcard>
    </article>
  );
}
