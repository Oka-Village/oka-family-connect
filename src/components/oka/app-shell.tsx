import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Bookmark, Coins, Gift, Heart, Home, LogOut, Menu, ShieldCheck, Sparkles, User, Users } from "lucide-react";

import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { resolvePhotoUrl, useProfile } from "@/hooks/use-profile";
import { useIsStaff } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { useClaimInvite } from "@/lib/affiliates";
import { cn } from "@/lib/utils";
import { CreditPill } from "@/components/oka/credit-pill";
import { NotificationsBell } from "@/components/oka/notifications-bell";
import { useMemberAccess } from "@/hooks/use-member-access";
import { MemberAccessGate } from "@/components/oka/member-access-gate";
import { SupportOkaDialog } from "@/components/oka/support-oka-dialog";
import { useMembership } from "@/hooks/use-membership";
import { hasPaidMembership } from "@/lib/membership";
import { showSupportOffer } from "@/lib/onboarding-rules";

const SUPPORT_EMAIL = "daniel@zoe.garden";

const NAV_ITEMS = [
  { to: "/home", label: "Home", icon: Heart },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/directory", label: "Members", icon: Users },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/houses", label: "Houses", icon: Home },
  { to: "/collections", label: "Collections", icon: Bookmark },
  { to: "/profile", label: "My Profile", icon: User },
  { to: "/credits", label: "Credits", icon: Coins },
  { to: "/affiliate", label: "Invite & earn", icon: Gift },
] as const;

const PRIMARY_ITEMS = NAV_ITEMS.slice(0, 6);
const MOBILE_ITEMS = [...PRIMARY_ITEMS, { to: "/affiliate", label: "Invite", icon: Gift } as const];

/** Desktop left sidebar, mobile bottom tab bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const access = useMemberAccess(pathname);
  const { data: profile, isLoading } = useProfile();
  useClaimInvite(Boolean(profile));
  const { data: isAdmin } = useIsStaff();
  const membership = useMembership(profile?.id);
  const [supportOpen, setSupportOpen] = useState(false);
  // Existing unpaid members get the same payment/trial offer as new ones, on each app entry.
  useEffect(() => {
    if (!profile || isAdmin !== false || membership.isPending || membership.isError) return;
    if (showSupportOffer(hasPaidMembership(membership.data), false, profile.trial_started_at)) setSupportOpen(true);
  }, [profile, isAdmin, membership.isPending, membership.isError, membership.data]);
  const photoQuery = useQuery({
    queryKey: ["profile-photo", profile?.photo_url ?? null],
    queryFn: () => resolvePhotoUrl(profile?.photo_url ?? null),
    enabled: Boolean(profile?.photo_url),
    staleTime: 60_000,
  });
  const photo = photoQuery.data ?? null;
  const unreadQuery = useQuery({
    queryKey: ["appreciation-unread", profile?.id ?? null],
    queryFn: async () => {
      if (!profile) return 0;
      const { count, error } = await supabase.from("appreciation_letters").select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: Boolean(profile),
    refetchOnWindowFocus: true,
  });
  const unreadCount = unreadQuery.data ?? 0;
  const { data: suspended } = useQuery({
    queryKey: ["my-suspension", profile?.id ?? null],
    queryFn: async () => {
      if (!profile) return false;
      const { data } = await supabase.from("member_suspensions").select("user_id").eq("user_id", profile.id).maybeSingle();
      return Boolean(data);
    },
    enabled: Boolean(profile),
    refetchOnWindowFocus: true,
  });
  const items = isAdmin
    ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: ShieldCheck } as const]
    : NAV_ITEMS;

  // Anyone who hasn't finished the welcome steps is taken back to them.
  useEffect(() => {
    if (!isLoading && profile && !profile.onboarded_at && access.fullAccess) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoading, profile, navigate, access.fullAccess]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (suspended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <Wordmark />
          <p className="section-label mt-8">Account suspended</p>
          <h1 className="mt-3 text-3xl text-foreground">Your account is on pause</h1>
          <p className="mt-4 text-muted-foreground">Your access to Oka has been suspended. If you think this is a mistake or want to talk about it, please write to us.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-full px-6"><a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("My Oka account is suspended")}`}>Contact us</a></Button>
            <Button variant="outline" className="rounded-full px-6" onClick={handleSignOut}><LogOut className="size-4" strokeWidth={1.5} /> Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  // Do not mount the child Outlet (or its data queries) until membership is resolved.
  if (access.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background" role="status"><p className="font-serif text-2xl text-muted-foreground">A moment, please…</p></div>;
  }
  if (access.isError) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6"><p className="text-muted-foreground" role="alert">We couldn’t check your access. Please try again.</p><Button className="rounded-full" onClick={access.retry}>Try again</Button><Button variant="ghost" onClick={handleSignOut}>Sign out</Button></div>;
  }
  if (!access.allowed) return <MemberAccessGate onSignOut={handleSignOut} />;

  return (
    <div className="min-h-screen bg-canvas p-0 lg:p-3">
      <div className="min-h-screen bg-background lg:min-h-[calc(100vh-1.5rem)] lg:rounded-2xl lg:border lg:border-border">
      <header className="sticky top-0 z-30 hidden items-center gap-8 border-b border-border bg-background/95 px-8 py-5 backdrop-blur lg:flex xl:px-14">
        <Link to="/home" aria-label="Oka home"><Wordmark /></Link>
        <nav className="flex rounded-full bg-cream-deep p-1">
          {PRIMARY_ITEMS.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-5 py-2 text-sm transition-all",
                  active ? "bg-card text-foreground shadow-nav" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">{item.label}{item.to === "/home" && unreadCount > 0 && <span className="absolute -right-3 -top-1 size-2 rounded-full bg-primary" aria-label={`${unreadCount} unread appreciation letters`} />}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <CreditPill />
          <NotificationsBell userId={profile?.id} />
          <details className="group relative">
            <Button asChild variant="secondary" size="icon" className="rounded-full">
              <summary aria-label="Open account menu" className="list-none [&::-webkit-details-marker]:hidden">
                {photo ? (
                  <MemberAvatar src={photo} name={profile?.display_name} className="size-9" />
                ) : (
                  <span className="font-serif text-lg">{profile?.display_name?.trim().charAt(0).toUpperCase() || <Menu className="size-4" />}</span>
                )}
              </summary>
            </Button>
            <div className="absolute right-0 top-12 z-50 hidden w-56 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-card group-open:block">
              <p className="px-3 py-2 text-sm text-muted-foreground">{profile?.display_name ?? "Your Oka"}</p>
              <div className="my-1 h-px bg-border" />
              {items.slice(6).map((item) => (
                <Link key={item.to} to={item.to} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent">
                  <item.icon className="size-4 text-primary" strokeWidth={1.5} />{item.label}
                </Link>
              ))}
              <div className="my-1 h-px bg-border" />
              <Button variant="ghost" className="w-full justify-start rounded-xl px-3" onClick={handleSignOut}><LogOut className="text-primary" strokeWidth={1.5} />Sign out</Button>
            </div>
          </details>
        </div>
      </header>

      <header className="flex items-center justify-between border-b border-border px-6 py-4 lg:hidden">
        <Link to="/home" aria-label="Oka home"><Wordmark className="text-2xl" /></Link>
        <div className="flex items-center gap-1">
        <NotificationsBell userId={profile?.id} />
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Sign out"
          onClick={handleSignOut}
        >
          <LogOut className="size-5 text-primary" strokeWidth={1.5} />
        </Button>
        </div>
      </header>

      <main className="pb-28">{children}</main>
      <SupportOkaDialog
        open={supportOpen}
        trialStartedAt={profile?.trial_started_at ?? null}
        onProceed={() => {
          setSupportOpen(false);
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          queryClient.invalidateQueries({ queryKey: ["membership"] });
          if (pathname !== "/welcome") void navigate({ to: "/welcome", replace: true });
        }}
      />

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-7 border-t border-border bg-sidebar px-1 py-2 lg:hidden">
        {MOBILE_ITEMS.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn("flex min-w-0 flex-col items-center gap-1 py-2 text-[0.6rem] whitespace-nowrap transition-colors", active ? "text-primary" : "text-muted-foreground")}
            >
              <item.icon className={cn("size-5", active && "text-primary")} strokeWidth={1.5} />
              <span className="relative">{item.label}{item.to === "/home" && unreadCount > 0 && <span className="absolute -right-3 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.55rem] leading-4 text-primary-foreground" aria-label={`${unreadCount} unread appreciation letters`}>{unreadCount > 9 ? "9+" : unreadCount}</span>}</span>
            </Link>
          );
        })}
      </nav>
      </div>
    </div>
  );
}
