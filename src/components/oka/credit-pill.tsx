import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Coins } from "lucide-react";

import {
  GiftTwoMonthsBannerRow,
  GiftTwoMonthsCta,
  GiftTwoMonthsDialog,
} from "@/components/oka/gift-two-months";
import { useProfile } from "@/hooks/use-profile";

/** Exact wording used by both the desktop header pill and the mobile banner. */
export const PROFILE_COMPLETION_PROMPT = "Complete your profile and earn 3 credits";

/**
 * Header slot: incomplete → profile prompt; 100% complete → Gift 2 months CTA.
 */
export function CreditPill() {
  const profile = useProfile();

  if (profile.data?.profile_completed === true) {
    return <GiftTwoMonthsCta />;
  }

  return (
    <Link
      to="/profile"
      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:opacity-90"
    >
      <Coins className="size-4 text-primary" strokeWidth={1.5} />
      {PROFILE_COMPLETION_PROMPT}
    </Link>
  );
}

/**
 * Mobile companion under the header: same completion gate as CreditPill.
 * Incomplete → prompt strip; complete → gift banner row.
 */
export function ProfileCompletionBanner() {
  const profile = useProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const completed = profile.data?.profile_completed === true;

  return (
    <div className="border-b border-border bg-secondary lg:hidden">
      <div className="flex items-center gap-3 px-6 py-3">
        {completed ? (
          <GiftTwoMonthsBannerRow onOpen={() => setDialogOpen(true)} />
        ) : (
          <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-secondary-foreground">
            <Coins className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
            <span className="flex-1">{PROFILE_COMPLETION_PROMPT}</span>
            <ChevronRight className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
          </Link>
        )}
      </div>
      {completed && <GiftTwoMonthsDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </div>
  );
}
