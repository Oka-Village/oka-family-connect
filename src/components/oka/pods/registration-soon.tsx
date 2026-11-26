import { useState } from "react";

import { PodsButton } from "@/components/oka/pods/pods-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const POD_REGISTRATION_SOON_MESSAGE =
  "Cohort registration is opening shortly. For early inquiries or questions, contact hello@oneworldfamily.app";

type Props = { variant?: "primary" | "outline"; className?: string };

export function RegistrationSoonButton({ variant = "outline", className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PodsButton variant={variant} className={className ?? ""} onClick={() => setOpen(true)}>
        Registration Opening Soon
      </PodsButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registration opening soon</DialogTitle>
            <DialogDescription>
              Cohort registration is opening shortly. For early inquiries or questions, contact{" "}
              <a className="underline" href="mailto:hello@oneworldfamily.app">
                hello@oneworldfamily.app
              </a>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
