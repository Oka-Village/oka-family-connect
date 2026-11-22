import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { useEnsureInviteCode } from "@/lib/affiliates";
import { joinUrl } from "@/lib/join-link";
import { cn } from "@/lib/utils";

/** Compact invite control for Events list surfaces — copies the member's join link. */
export function EventInviteChip({
  slug,
  label,
  className,
  dark,
}: {
  slug: string;
  label?: string;
  className?: string;
  dark?: boolean;
}) {
  const { data: uid } = useCurrentUserId();
  const affiliate = useEnsureInviteCode(uid);
  const refCode = affiliate.data ?? null;
  const busy = affiliate.isPending || affiliate.isFetching;

  async function copy() {
    if (!refCode) {
      toast.error(affiliate.isError ? "Couldn't prepare your invitation." : "Your invite link isn't ready yet.");
      if (affiliate.isError) void affiliate.refetch();
      return;
    }
    try {
      await navigator.clipboard.writeText(joinUrl(slug, refCode));
      toast.success("Join link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }

  if (label) {
    return (
      <Button
        type="button"
        variant="outline"
        className={cn(
          "min-h-10 rounded-full px-5",
          dark && "border-cream/35 bg-transparent text-cream hover:bg-cream/10 hover:text-cream",
          className,
        )}
        disabled={busy && !refCode}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void copy();
        }}
      >
        {label}
      </Button>
    );
  }

  return (
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
      disabled={busy && !refCode}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void copy();
      }}
    >
      <Mail className="size-4" strokeWidth={1.5} />
    </Button>
  );
}
