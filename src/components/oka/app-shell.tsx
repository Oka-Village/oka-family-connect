import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { CalendarDays, Coins, Home, LogOut, ShieldCheck, Sparkles, User, Users } from "lucide-react";

import { Wordmark } from "@/components/oka/wordmark";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useIsStaff } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/directory", label: "Directory", icon: Users },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/houses", label: "Houses", icon: Home },
  { to: "/profile", label: "My Profile", icon: User },
  { to: "/credits", label: "Credits", icon: Coins },
] as const;

/** Desktop left sidebar, mobile bottom tab bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile, isLoading } = useProfile();
  const { data: isAdmin } = useIsStaff();
  const items = isAdmin
    ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: ShieldCheck } as const]
    : NAV_ITEMS;

  // Anyone who hasn't finished the welcome steps is taken back to them.
  useEffect(() => {
    if (!isLoading && profile && !profile.profile_completed) {
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
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-sidebar px-6 py-8 lg:flex">
        <Link to="/events" className="px-2">
          <Wordmark />
        </Link>
        <p className="section-label mt-10 px-2">Circle</p>
        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-5 text-primary" strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button
          variant="ghost"
          className="mt-6 justify-start gap-3 rounded-full px-4 text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="size-5 text-primary" strokeWidth={1.5} />
          Sign out
        </Button>
      </aside>

      <header className="flex items-center justify-between border-b border-border px-6 py-5 lg:hidden">
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

      <main className="pb-28 lg:pb-0 lg:pl-64">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-between border-t border-border bg-sidebar px-2 py-2 lg:hidden">
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.625rem] transition-colors",
                active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5 text-primary" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
