import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";

import { useProfile } from "@/hooks/use-profile";
import { useCredits } from "@/lib/skills";

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
        <Coins className="size-4 text-primary" strokeWidth={1.5} />Complete your profile and earn 3 credits
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
