import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useRoles } from "@/hooks/use-is-admin";
import { useMembership } from "@/hooks/use-membership";
import { hasPaidMembership, isPaymentExempt, isPublicEntryRoute, paymentRedirect, trialState } from "@/lib/membership";
import { saveInviteCode, useClaimInvite } from "@/lib/affiliates";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";
import { isAuthFailure, recoverSession, restoreSession, sessionStorageKey } from "@/lib/session-restore";
import { isPublicEventRoute } from "@/lib/public-events";

/** Covers public routes and full-bleed onboarding too, before mounting their content. */
export function MembershipBoundary({ children }: { children: ReactNode }) {
  const location = useRouterState({ select: (s) => s.location });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const recovering = useRef(false);
  const session = useQuery({
    queryKey: ["membership-session"],
    queryFn: () => restoreSession(async () => {
      // Read the stored login first; the server check below only confirms it.
      const { data: local } = await supabase.auth.getSession();
      if (!local.session) return null;
      const { data, error } = await supabase.auth.getUser();
      if (error && error.name === "AuthSessionMissingError") return null;
      if (error && isAuthFailure(error)) throw error;
      // Network trouble keeps the member signed in with their stored login.
      return data.user?.id ?? local.session.user.id;
    }),
    retry: (count, error) => !isAuthFailure(error) && count < 3,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
    staleTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!session.isError || !isAuthFailure(session.error) || recovering.current) return;
    recovering.current = true;
    void qc.cancelQueries();
    qc.clear();
    void recoverSession(async () => {
      const apiUrl = import.meta.env['VITE_SUPABASE_URL'];
      if (!apiUrl) return;
      const key = sessionStorageKey(apiUrl);
      const storage = brokeredPreviewStorage();
      await Promise.all([key, `${key}-user`].map(async (name) => {
        // Clear the local copy immediately, even if the preview broker is slow.
        try { localStorage.removeItem(name); } catch { /* blocked browser storage */ }
        await storage?.removeItem(name);
      }));
    }, (path) => window.location.replace(path));
  }, [session.isError, session.error, qc]);
  const profile = useProfile();
  const roles = useRoles();
  const membership = useMembership(profile.data?.id);
  const exempt = isPaymentExempt(profile.data, roles.data?.isStaff === true);
  const paid = hasPaidMembership(membership.data);
  // Background refetches (e.g. on tab focus) must not unmount the page and wipe forms.
  const loading = session.isPending || (session.isFetching && session.data === undefined) || profile.isPending || Boolean(session.data && (roles.isPending || (!exempt && profile.data && membership.isPending)));
  const failed = session.isError || profile.isError || Boolean(session.data && (roles.isError || (!exempt && membership.isError) || !profile.isPending && !profile.data));
  // Free profile creation is the sole exception; member content remains gated.
  const publicEvent = isPublicEventRoute(location.pathname.replace(/\/+$/, ""));
  const destination = publicEvent ? null : session.data
    ? location.pathname === "/onboarding" ? null
      : !profile.data?.onboarded_at && ["/", "/home"].includes(location.pathname) ? "/onboarding"
      : paymentRedirect(location.pathname, exempt, paid, trialState(profile.data?.trial_started_at, new Date(), profile.data?.trial_ends_at))
    : isPublicEntryRoute(location.pathname) ? null : "/membership";
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
    }     else if (destination === "/onboarding") void navigate({ to: "/onboarding", replace: true });
    else void navigate({ to: "/home", replace: true });
  }, [loading, failed, destination, navigate, location.pathname, location.searchStr]);
  async function signOut() {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }
  // Only safe published event data can render before membership resolution.
  if (publicEvent) return <>{children}</>;
  if (failed) return <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6"><p role="alert" className="text-muted-foreground">We couldn’t check your membership. Please try again.</p><Button onClick={() => { void session.refetch(); void profile.refetch(); void roles.refetch(); void membership.refetch(); }}>Try again</Button><Button variant="ghost" onClick={signOut}>Sign out</Button></main>;
  if (loading || destination) return <main className="flex min-h-screen items-center justify-center bg-background" role="status"><p className="font-serif text-2xl text-muted-foreground">A moment, please…</p></main>;
  return <>{children}</>;
}