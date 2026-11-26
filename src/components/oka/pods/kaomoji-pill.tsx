import { getKaomoji, type KaomojiId } from "@/lib/pods/kaomoji";
import { cn } from "@/lib/utils";

type Props = {
  id: KaomojiId;
  /** Optional tint class like pods-tint-forest */
  tintClassName?: string;
  className?: string;
  showName?: boolean;
};

export function KaomojiPill({ id, tintClassName, className, showName = true }: Props) {
  const k = getKaomoji(id);
  return (
    <span className={cn("pods-kaomoji", tintClassName, className)}>
      <span className="face" aria-hidden="true">
        {k.face}
      </span>
      {showName ? <span className="name">{k.name}</span> : null}
    </span>
  );
}
