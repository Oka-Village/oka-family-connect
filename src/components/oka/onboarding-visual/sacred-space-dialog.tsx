import { useState } from "react";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const COMMITMENTS = [
  "Practicing kindness, compassion, and nonviolent communication.",
  "Listening deeply, without judgment or shame.",
  "Acting with mindfulness, integrity, and respect.",
  "Honoring equality and avoiding power dynamics.",
  "Being of service to others and contributing positively to our shared community.",
] as const;

/** Client-side gate only. Nothing here is written to the profile. */
export function SacredSpaceDialog({ open, onOpenChange, onAccept }: { open: boolean; onOpenChange: (open: boolean) => void; onAccept: () => void }) {
  const [checked, setChecked] = useState<boolean[]>(() => COMMITMENTS.map(() => false));
  const ready = checked.every(Boolean);

  function toggle(index: number) {
    setChecked((current) => current.map((value, i) => (i === index ? !value : value)));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChecked(COMMITMENTS.map(() => false));
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[min(720px,calc(100vh-2rem))] max-w-xl overflow-y-auto rounded-3xl border-border bg-card px-6 py-7 sm:px-8">
        <DialogHeader>
          <p className="section-label">Writing</p>
          <DialogTitle className="pt-3 text-left font-serif text-3xl font-medium leading-tight text-foreground">
            Welcome to the Sacred Space of One World Family
          </DialogTitle>
          <DialogDescription className="sr-only">Five commitments must be accepted before entering the profile.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-foreground">
          <p>This is a safe space for every soul to feel seen, heard, and accepted. Here, <strong>all souls are equal</strong>, and we choose kindness, gentleness, mindfulness, and love.</p>
          <p>Your challenges, pain, and vulnerability are welcome here. Judgment, criticism, shaming, manipulation, and harmful power dynamics are not.</p>
          <p>We leave politics, news, conflicts, unsolicited promotions, and divisive conversations outside this space.</p>
          <p className="font-semibold">By entering, I commit to:</p>
          <ul className="space-y-3">
            {COMMITMENTS.map((line, index) => (
              <li key={line}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked[index]}
                    onChange={() => toggle(index)}
                    className="mt-0.5 size-4 shrink-0 accent-sage"
                  />
                  <span>{line}</span>
                </label>
              </li>
            ))}
          </ul>
          <p>I understand that this is a space for conscious connection, growth, healing, and belonging.</p>
          <p className="font-semibold">I enter with an open heart, taking responsibility for the energy I bring.</p>
        </div>
        <Button
          className="h-12 w-full rounded-full bg-brown text-cream hover:bg-brown/90"
          disabled={!ready}
          onClick={onAccept}
        >
          <Heart className="size-4" strokeWidth={1.5} />
          I Accept & Enter the Sacred Space
        </Button>
      </DialogContent>
    </Dialog>
  );
}
