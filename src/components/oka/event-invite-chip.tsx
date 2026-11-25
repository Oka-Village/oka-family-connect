import { useState } from "react";
import { Mail } from "lucide-react";

import { InviteFriendDialog, type InviteEvent } from "@/components/oka/invite-friend";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Compact invite control for Events list surfaces — opens the event invite dialog. */
export function EventInviteChip({
  event,
  label,
  className,
  dark,
}: {
  event: InviteEvent;
  label?: string;
  className?: string;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function openDialog(e: { preventDefault(): void; stopPropagation(): void }) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  if (label) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "min-h-10 rounded-full px-5",
            dark && "border-cream/35 bg-transparent text-cream hover:bg-cream/10 hover:text-cream",
            className,
          )}
          onClick={openDialog}
        >
          <span className="font-kaomoji" aria-hidden>
            (´◡`)っ✿
          </span>
          {label}
        </Button>
        <InviteFriendDialog open={open} onOpenChange={setOpen} event={event} />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Invite a friend"
        title="Invite a friend"
        className={cn(
          "size-10 shrink-0 rounded-full",
          dark && "border-cream/35 bg-transparent text-cream hover:bg-cream/10 hover:text-cream",
          className,
        )}
        onClick={openDialog}
      >
        <Mail className="size-4" strokeWidth={1.5} />
      </Button>
      <InviteFriendDialog open={open} onOpenChange={setOpen} event={event} />
    </>
  );
}
