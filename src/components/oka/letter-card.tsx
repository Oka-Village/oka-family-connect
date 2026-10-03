import { formatDistanceToNow } from "date-fns";

import { MemberAvatar } from "@/components/oka/profile-sections";
import type { AppreciationLetter } from "@/lib/appreciation";

export function LetterCard({ letter, kind, onOpen }: { letter: AppreciationLetter; kind: "received" | "sent"; onOpen?: () => void }) {
  const unread = kind === "received" && !letter.read_at;
  return (
    <article className="surface-card relative p-6" onClick={onOpen} onFocus={onOpen} tabIndex={unread ? 0 : undefined}>
      {unread && <span className="absolute right-5 top-5 size-2.5 rounded-full bg-primary" aria-label="Unread" />}
      <div className="flex items-center gap-3">
        <MemberAvatar src={letter.person?.photo} name={letter.person?.display_name} className="size-11" />
        <div><p className="font-medium text-foreground">{kind === "received" ? "From" : "To"} {letter.person?.display_name ?? "an Oka member"}</p><p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(letter.created_at), { addSuffix: true })}</p></div>
      </div>
      <p className="mt-5 font-serif text-2xl leading-relaxed text-foreground">{letter.body}</p>
    </article>
  );
}