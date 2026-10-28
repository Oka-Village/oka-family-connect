import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { beginSignupFlow } from "@/lib/signup-flow.functions";

type Mode = "signin" | "signup" | "forgot";

export function EmailAuthDialog({ label = "Use email instead", initialMode = "signup" }: { label?: string; initialMode?: Mode }) {
  const beginSignup = useServerFn(beginSignupFlow);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await beginSignup();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setSent("We sent you a confirmation link. Open it to finish joining.");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setOpen(false);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Join with email" : mode === "signin" ? "Sign in with email" : "Reset your password";

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSent(null); setMode(initialMode); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="rounded-full px-8">{label}</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">{title}</DialogTitle>
          <DialogDescription>
            {mode === "forgot" ? "We'll email you a link to choose a new password." : "Use any email address and a password."}
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <p className="text-sm text-muted-foreground">{sent}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input id="auth-password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full rounded-full" disabled={busy}>
              {busy ? "One moment…" : mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
            <div className="flex flex-col items-center gap-1 text-sm">
              {mode !== "signup" && <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("signup")}>New here? Create an account</button>}
              {mode !== "signin" && <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("signin")}>Already a member? Sign in</button>}
              {mode === "signin" && <button type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode("forgot")}>Forgot password?</button>}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
