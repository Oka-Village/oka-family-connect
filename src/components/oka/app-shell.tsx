import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Coins, Gift, Home, LogOut, Menu, ShieldCheck, Sparkles, User, Users } from "lucide-react";

import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/oka/profile-sections";
import { resolvePhotoUrl, useProfile } from "@/hooks/use-profile";
import { useIsStaff } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { useClaimInvite } from "@/lib/affiliates";
import { cn } from "@/lib/utils";
import { CreditPill } from "@/components/oka/credit-pill";

const NAV_ITEMS = [
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/directory", label: "Directory", icon: Users },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/houses", label: "Houses", icon: Home },
  { to: "/profile", label: "My Profile", icon: User },
  { to: "/credits", label: "Credits", icon: Coins },
  { to: "/affiliate", label: "Invite & earn", icon: Gift },
] as const;

const PRIMARY_ITEMS = NAV_ITEMS.slice(0, 4);

/** Desktop left sidebar, mobile bottom tab bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile, isLoading } = useProfile();
  useClaimInvite(Boolean(profile));
  const { data: isAdmin } = useIsStaff();
  const photoQuery = useQuery({
    queryKey: ["profile-photo", profile?.photo_url ?? null],
    queryFn: () => resolvePhotoUrl(profile?.photo_url ?? null),
    enabled: Boolean(profile?.photo_url),
    staleTime: 60_000,
  });
  const photo = photoQuery.data ?? null;
  const items = isAdmin
    ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: ShieldCheck } as const]
    : NAV_ITEMS;

  // Anyone who hasn't finished the welcome steps is taken back to them.
  useEffect(() => {
    if (!isLoading && profile && !profile.onboarded_at) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoading, profile, navigate]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-canvas p-0 lg:p-3">
      <div className="min-h-screen bg-background lg:min-h-[calc(100vh-1.5rem)] lg:rounded-2xl lg:border lg:border-border">
      <header className="sticky top-0 z-30 hidden items-center gap-8 border-b border-border bg-background/95 px-8 py-5 backdrop-blur lg:flex xl:px-14">
        <Link to="/events"><Wordmark /></Link>
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
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <CreditPill />
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
              {items.slice(4).map((item) => (
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
        <Wordmark className="text-2xl" />
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Sign out"
          onClick={handleSignOut}
        >
          <LogOut className="size-5 text-primary" strokeWidth={1.5} />
        </Button>
      </header>

      <main className="pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-between border-t border-border bg-sidebar px-2 py-2 lg:hidden">
        {[...PRIMARY_ITEMS, { to: "/profile", label: "You", icon: User } as const].map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn("flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[0.625rem] transition-colors", active ? "text-primary" : "text-muted-foreground")}
            >
              <item.icon className={cn("size-5", active && "text-primary")} strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      </div>
    </div>
  );
}
