import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { AppShell } from "./app-shell";
import { Wordmark } from "./wordmark";
import { EventSignIn } from "./event-sign-in";

export function EventPageShell({ children }: { children: ReactNode }) {
  const uid = useCurrentUserId();
  if (uid.data) return <AppShell>{children}</AppShell>;
  return <div className="min-h-screen bg-background">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5 lg:px-10">
      <Link to="/" aria-label="Oka home"><Wordmark /></Link>
      <div className="flex items-center gap-5"><Link to="/events" className="text-sm text-foreground">Events</Link><Link to="/skills" className="text-sm text-foreground">Skills</Link><Link to="/houses" className="text-sm text-foreground">Homes</Link><EventSignIn /></div>
    </header>
    <main>{children}</main>
  </div>;
}