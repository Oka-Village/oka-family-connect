import { Link } from "@tanstack/react-router";
import { ChevronRight, Coins } from "lucide-react";

import { useProfile } from "@/hooks/use-profile";
import { useCredits } from "@/lib/skills";

/** Exact wording used by both the desktop header pill and the mobile banner. */
export const PROFILE_COMPLETION_PROMPT = "Complete your profile and earn 3 credits";

/**
 * Available-credits pill; at zero it becomes a warm invitation to earn. All numbers come from the database.
 * While the member's profile is incomplete, the pill instead invites them to finish it and links to My Profile.
 */
export function CreditPill() {
  const credits = useCredits();
  const profile = useProfile();
  if (!credits.data) return <span className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">…</span>;

  // Only switch once the profile row is known; an unknown profile keeps the credit wording.
  if (profile.data && profile.data.profile_completed === false) {
    return (
      <Link to="/profile" className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:opacity-90">
        <Coins className="size-4 text-primary" strokeWidth={1.5} />{PROFILE_COMPLETION_PROMPT}
      </Link>
    );
  }

  const n = credits.data.available;
  if (n <= 0) {
    return (
      <Link to="/credits" className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground hover:opacity-90">
        <Coins className="size-4 text-primary" strokeWidth={1.5} />No credits yet — host or offer a skill to earn
      </Link>
    );
  }
  return (
    <Link to="/credits" className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:opacity-90">
      <Coins className="size-4 text-primary" strokeWidth={1.5} />{n} credit{n === 1 ? "" : "s"} available
    </Link>
  );
}

/**
 * Mobile companion to the header pill, which phones never render: the same invitation as a
 * compact sage strip directly under the mobile header. Silent once the profile is complete.
 */
export function ProfileCompletionBanner() {
  const profile = useProfile();
  if (!profile.data || profile.data.profile_completed !== false) return null;
  return (
    <div className="border-b border-border bg-secondary lg:hidden">
      <Link to="/profile" className="flex items-center gap-2 px-6 py-3 text-sm text-secondary-foreground">
        <Coins className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
        <span className="flex-1">{PROFILE_COMPLETION_PROMPT}</span>
        <ChevronRight className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
      </Link>
    </div>
  );
}
