import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { giftUrl } from "@/lib/gift";

/** Permanent gift link QR plus share/copy controls for the giver. */
export function GiftQrPanel({ code }: { code: string }) {
  const link = giftUrl(code);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("qrcode")
      .then((QR) => QR.toDataURL(link, { width: 560, margin: 1, color: { dark: "#372C24", light: "#F9F8F4" } }))
      .then((url) => {
        if (!cancelled) setQr(url);
      });
    return () => {
      cancelled = true;
    };
  }, [link]);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Two months in One World Family",
          text: "A gift for you: your first two months in One World Family.",
          url: link,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div className="mx-auto aspect-square w-full max-w-72 overflow-hidden rounded-2xl bg-card p-3 shadow-sm">
        {qr ? <img src={qr} alt="Gift QR code" className="size-full" /> : <div className="size-full animate-pulse rounded-xl bg-muted" />}
      </div>
      <code className="block truncate rounded-full bg-secondary px-4 py-2 text-center text-xs text-secondary-foreground">{link}</code>
      <div className="flex gap-2">
        <Button className="flex-1 rounded-full" onClick={() => void share()}>
          <Share2 className="size-4" strokeWidth={1.5} />
          Share link
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-full"
          onClick={() => {
            void navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-4" strokeWidth={1.5} /> : <Copy className="size-4" strokeWidth={1.5} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
