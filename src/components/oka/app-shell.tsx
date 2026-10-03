import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { CalendarDays, Coins, Gift, Home, LogOut, Menu, ShieldCheck, Sparkles, User, Users } from "lucide-react";

import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useIsStaff } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { useClaimInvite } from "@/lib/affiliates";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full" aria-label="Open account menu">
                <span className="font-serif text-lg">{profile?.display_name?.trim().charAt(0).toUpperCase() || <Menu className="size-4" />}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
              <DropdownMenuLabel className="font-normal text-muted-foreground">{profile?.display_name ?? "Your Oka"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {items.slice(4).map((item) => <DropdownMenuItem key={item.to} asChild className="rounded-xl"><Link to={item.to}><item.icon className="text-primary" strokeWidth={1.5} />{item.label}</Link></DropdownMenuItem>)}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl" onSelect={() => void handleSignOut()}><LogOut className="text-primary" strokeWidth={1.5} />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              <item.icon className="size-5 text-primary" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      </div>
    </div>
  );
}
