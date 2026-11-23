import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailAuthDialog } from "./email-auth";
import { signInWithGoogle } from "@/lib/google-sign-in";
import { beginSignupFlow } from "@/lib/signup-flow.functions";
import { saveReturnTo } from "@/lib/join-link";
import { useCurrentUserId } from "@/hooks/use-is-admin";

export function EventSignIn({ label = "Sign in / Sign up" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const uid = useCurrentUserId();
  const beginSignup = useServerFn(beginSignupFlow);
  async function google() {
    setBusy(true);
    try {
      await beginSignup();
      await signInWithGoogle(window.location.origin);
    } catch {
      toast.error("We couldn't open sign-in. Please try again.");
    } finally { setBusy(false); }
  }
  return <>
    <Button className="rounded-full" onClick={() => {
      saveReturnTo(window.location.pathname + window.location.search);
      setOpen(true);
    }}>{label}</Button>
    <Dialog open={open && !uid.data} onOpenChange={setOpen}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">Join the gathering</DialogTitle>
          <DialogDescription>Sign in or create an account to RSVP.</DialogDescription>
        </DialogHeader>
        <Button className="rounded-full" disabled={busy} onClick={google}>{busy ? "Opening…" : "Continue with Google"}</Button>
        <EmailAuthDialog label="Continue with email" initialMode="signin" />
      </DialogContent>
    </Dialog>
  </>;
}