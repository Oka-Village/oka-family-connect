import { useEffect, useState } from "react";
import { Check, Copy, Gift, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUserId } from "@/hooks/use-is-admin";
import { inviteUrl } from "@/lib/affiliate-share";
import { useEnsureInviteCode } from "@/lib/affiliates";
import { cn } from "@/lib/utils";

/** Compact CTA that opens the gift QR dialog. */
export function GiftTwoMonthsCta({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90",
          className,
        )}
      >
        <Gift className="size-4" strokeWidth={1.5} />
        Gift 2 months
      </button>
      <GiftTwoMonthsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Card-style gift row for the mobile banner (matches the design strip). */
export function GiftTwoMonthsBannerRow({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Gift two months</p>
        <p className="mt-0.5 text-sm text-secondary-foreground">Show a QR code that opens two free months for someone new.</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
      >
        <Gift className="size-4" strokeWidth={1.5} />
        Gift 2 months
      </button>
    </div>
  );
}

export function GiftTwoMonthsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: uid } = useCurrentUserId();
  const invite = useEnsureInviteCode(uid, open && Boolean(uid));
  const link = invite.data ? inviteUrl(invite.data) : "";
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!link) {
      setQr(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(link, { width: 280, margin: 2, color: { dark: "#3D2C29", light: "#FAF6EF" } })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Gift two months</DialogTitle>
          <DialogDescription>
            Show this QR code so someone new can open two free months through your invite.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col items-center gap-4">
          {invite.isLoading || !uid ? (
            <Loader2 className="size-8 animate-spin text-primary" strokeWidth={1.5} />
          ) : invite.isError ? (
            <p className="text-center text-sm text-destructive">
              Couldn&apos;t prepare your invite link.{" "}
              <button type="button" className="underline" onClick={() => void invite.refetch()}>
                Try again
              </button>
            </p>
          ) : !invite.data ? (
            <p className="text-center text-sm text-muted-foreground">
              Your invite link is paused by the Oka team. Reach out if you think this is a mistake.
            </p>
          ) : qr ? (
            <img src={qr} alt="Invite QR code" className="size-70 rounded-xl bg-cream" />
          ) : (
            <Loader2 className="size-8 animate-spin text-primary" strokeWidth={1.5} />
          )}

          {link && (
            <div className="flex w-full flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-full bg-secondary px-4 py-2 text-xs text-secondary-foreground">
                {link}
              </code>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  void navigator.clipboard.writeText(link).then(
                    () => {
                      setCopied(true);
                      toast.success("Invite link copied");
                      setTimeout(() => setCopied(false), 2000);
                    },
                    () => toast.error("Could not copy the link"),
                  );
                }}
              >
                {copied ? <Check className="size-4" strokeWidth={1.5} /> : <Copy className="size-4" strokeWidth={1.5} />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
