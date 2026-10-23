import { Link } from "@tanstack/react-router";
import { CalendarPlus, Gift, Home, LogOut, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/oka/wordmark";

const CONTRIBUTIONS = [
  { to: "/skills/new", label: "Add a skill", icon: Sparkles },
  { to: "/houses/new", label: "Add your house", icon: Home },
  { to: "/events/new", label: "Add an event", icon: CalendarPlus },
  { to: "/affiliate", label: "Invite friends", icon: Gift },
] as const;

export function MemberAccessGate({ onSignOut }: { onSignOut: () => Promise<void> }) {
  return (
    <div className="flex min-h-screen flex-col bg-background px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Wordmark />
        <Button variant="ghost" className="rounded-full" onClick={onSignOut}><LogOut className="size-4 text-primary" strokeWidth={1.5} />Sign out</Button>
      </header>
      <main className="flex flex-1 items-center justify-center py-12">
        <section className="surface-card w-full max-w-xl p-7 text-center sm:p-12">
          <p className="section-label">Welcome to Oka</p>
          <h1 className="mt-4 text-4xl text-foreground sm:text-5xl">Your place is kept.</h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">Full access opens on December 1, 2026. Until then, you can share what you’d love to offer and invite friends to join you.</p>
          <Button asChild className="mt-8 h-12 rounded-full px-8"><Link to="/welcome">Make yourself at home</Link></Button>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {CONTRIBUTIONS.map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="outline" className="h-12 rounded-full"><Link to={to}><Icon className="size-4 text-primary" strokeWidth={1.5} />{label}</Link></Button>)}
          </div>
          <Button asChild variant="ghost" className="mt-5 rounded-full"><Link to="/profile"><User className="size-4 text-primary" strokeWidth={1.5} />My profile</Link></Button>
          <div className="mt-6 flex justify-center gap-5 text-xs text-muted-foreground"><Link to="/privacy" className="hover:text-foreground">Privacy</Link><Link to="/terms" className="hover:text-foreground">Terms</Link></div>
        </section>
      </main>
    </div>
  );
}