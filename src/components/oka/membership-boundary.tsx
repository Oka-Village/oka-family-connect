import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useRoles } from "@/hooks/use-is-admin";
import { useMembership } from "@/hooks/use-membership";
import { useMemberAccess } from "@/hooks/use-member-access";
import { hasPaidMembership, paymentRedirect } from "@/lib/membership";
import { saveInviteCode, useClaimInvite } from "@/lib/affiliates";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/** Covers public routes and full-bleed onboarding too, before mounting their content. */
export function MembershipBoundary({ children }: { children: ReactNode }) {
  const location = useRouterState({ select: (s) => s.location });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profile = useProfile();
  const roles = useRoles();
  const access = useMemberAccess(location.pathname);
  const membership = useMembership(profile.data?.id);
  const full = roles.data?.isStaff === true || access.fullAccess;
  const paid = hasPaidMembership(membership.data);
  const loading = profile.isPending || Boolean(profile.data && (roles.isPending || (!full && membership.isPending)));
  const failed = profile.isError || Boolean(profile.data && (roles.isError || (!full && membership.isError)));
  const destination = profile.data ? paymentRedirect(location.pathname, full, paid) : null;
  const inviteCode = /^\/invite\/([^/]+)$/.exec(location.pathname)?.[1];
  // Persist attribution before the payment redirect; claim on the membership page.
  useEffect(() => { if (inviteCode) saveInviteCode(decodeURIComponent(inviteCode)); }, [inviteCode]);
  useClaimInvite(Boolean(profile.data && !inviteCode));
  useEffect(() => {
    if (loading || failed || !destination) return;
    if (destination === "/membership") {
      const search = new URLSearchParams(location.searchStr);
      const session = location.pathname === "/founding" ? search.get("session_id") : null;
      void navigate({ to: "/membership", replace: true, search: { session_id: session ?? undefined, kind: "founding" } });
    } else void navigate({ to: "/home", replace: true });
  }, [loading, failed, destination, navigate, location.pathname, location.searchStr]);
  async function signOut() {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }
  if (failed) return <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6"><p role="alert" className="text-muted-foreground">We couldn’t check your membership. Please try again.</p><Button onClick={() => { void profile.refetch(); void roles.refetch(); void membership.refetch(); }}>Try again</Button><Button variant="ghost" onClick={signOut}>Sign out</Button></main>;
  if (loading || destination) return <main className="flex min-h-screen items-center justify-center bg-background" role="status"><p className="font-serif text-2xl text-muted-foreground">A moment, please…</p></main>;
  return <>{children}</>;
}