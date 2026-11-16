import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Gift, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adminSetComplimentaryAccess, adminUpdateTrial } from "@/lib/admin-trial.functions";
import { TRIAL_ACCESS_LAUNCH_AT, trialEndDate } from "@/lib/trial-access";

export function AdminTrialDialog({ userId, name, trialStartedAt, trialEndsAt, complimentaryAccess, open, onOpenChange }: {
  userId: string;
  name: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  complimentaryAccess: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const updateTrial = useServerFn(adminUpdateTrial);
  const setComplimentary = useServerFn(adminSetComplimentaryAccess);
  const [customDate, setCustomDate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentEnd = trialEndDate(trialStartedAt, trialEndsAt);
  const paused = !trialEndsAt && Boolean(trialStartedAt) && Date.now() < Date.parse(TRIAL_ACCESS_LAUNCH_AT);

  async function save(key: string, action: "extend" | "set" | "end" | "reset", days?: number, endsAt?: string) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await updateTrial({ data: { userId, action, days, endsAt } });
      toast.success(action === "end" ? "Trial ended" : action === "reset" ? "Standard seven-day rule restored" : "Trial access updated");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "members"] }),
        qc.invalidateQueries({ queryKey: ["profile"] }),
      ]);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The trial could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  async function saveComplimentary() {
    if (busy) return;
    if (complimentaryAccess && !confirm(`Remove complimentary access for ${name || "this member"}? Their paid membership, if any, stays unchanged.`)) return;
    setBusy("complimentary");
    setError(null);
    try {
      await setComplimentary({ data: { userId, enabled: !complimentaryAccess } });
      toast.success(complimentaryAccess ? "Complimentary access removed" : "Complimentary lifetime access granted");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "members"] }),
        qc.invalidateQueries({ queryKey: ["profile"] }),
      ]);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The member's access could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  function saveCustomDate() {
    if (!customDate) return setError("Choose a trial end date and time.");
    const parsed = new Date(customDate);
    if (Number.isNaN(parsed.getTime())) return setError("Choose a valid trial end date and time.");
    void save("custom", "set", undefined, parsed.toISOString());
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl p-6 sm:p-8">
      <DialogHeader>
        <DialogTitle className="font-serif text-3xl font-normal tracking-normal">Trial & member access</DialogTitle>
        <DialogDescription>{name || "This member"} · changes apply only to this account.</DialogDescription>
      </DialogHeader>

      <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
        <p className="font-medium">{complimentaryAccess ? "Complimentary lifetime access is on" : paused ? "Trial is paused until December 1" : currentEnd ? `Trial ends ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(currentEnd)}` : "No trial has started"}</p>
        <p className="mt-1 text-muted-foreground">The standard seven-day count begins on December 1, or on the member's actual start date after launch.</p>
      </div>

      <section className="grid gap-3 border-t border-border pt-5">
        <h3 className="flex items-center gap-2 font-serif text-xl"><CalendarClock className="size-5 text-primary" strokeWidth={1.5} />Extend the current trial</h3>
        <p className="text-sm text-muted-foreground">Days are added to the current effective end. If it already ended, they start from now.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[7, 14, 21, 30].map((days) => <Button key={days} variant="outline" className="rounded-full" disabled={busy !== null} onClick={() => void save(`extend-${days}`, "extend", days)}>
            {busy === `extend-${days}` ? <Loader2 className="size-4 animate-spin" /> : `+${days} days`}
          </Button>)}
        </div>
      </section>

      <section className="grid gap-3 border-t border-border pt-5">
        <h3 className="font-serif text-xl">Choose a specific end</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="datetime-local" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="rounded-xl" aria-label="Custom trial end" />
          <Button className="shrink-0 rounded-full" disabled={busy !== null} onClick={saveCustomDate}>
            {busy === "custom" && <Loader2 className="size-4 animate-spin" />}Save end date
          </Button>
        </div>
      </section>

      <section className="flex flex-wrap gap-2 border-t border-border pt-5">
        <Button variant="outline" className="rounded-full" disabled={busy !== null || (!trialStartedAt && !trialEndsAt)} onClick={() => {
          if (confirm(`End the trial for ${name || "this member"} now? Complimentary or paid access is not changed.`)) void save("end", "end");
        }}>{busy === "end" && <Loader2 className="size-4 animate-spin" />}End trial now</Button>
        <Button variant="ghost" className="rounded-full" disabled={busy !== null || !trialEndsAt} onClick={() => void save("reset", "reset")}>
          <RotateCcw className="size-4 text-primary" strokeWidth={1.5} />Use standard rule
        </Button>
      </section>

      <section className="grid gap-3 border-t border-border pt-5">
        <h3 className="flex items-center gap-2 font-serif text-xl"><Gift className="size-5 text-primary" strokeWidth={1.5} />Complimentary access</h3>
        <p className="text-sm text-muted-foreground">Grant full member access without creating a payment or changing the member's stored membership status.</p>
        <Button variant={complimentaryAccess ? "outline" : "default"} className="w-fit rounded-full" disabled={busy !== null} onClick={() => void saveComplimentary()}>
          {busy === "complimentary" && <Loader2 className="size-4 animate-spin" />}
          {complimentaryAccess ? "Remove complimentary access" : "Grant lifetime free access"}
        </Button>
      </section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent>
  </Dialog>;
}
