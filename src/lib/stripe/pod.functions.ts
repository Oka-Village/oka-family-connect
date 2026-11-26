/**
 * Pod join checkout via the owner's Stripe Payment Link.
 * client_reference_id carries the pod_enrollments.id so the webhook can confirm the seat.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POD_COMMITMENTS } from "@/lib/pods/constants";
import { POD_PAYMENT_LINK } from "@/lib/pods/config";

export const startPodCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        podId: z.string().uuid(),
        acceptedCommitmentIds: z.array(z.string()).length(POD_COMMITMENTS.length),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const expected = new Set(POD_COMMITMENTS.map((c) => c.id));
    if (data.acceptedCommitmentIds.some((id) => !expected.has(id)) || new Set(data.acceptedCommitmentIds).size !== POD_COMMITMENTS.length) {
      throw new Error("Please confirm all five commitments.");
    }

    const commitments = POD_COMMITMENTS.map((c) => ({
      id: c.id,
      title: c.title,
      text: c.text,
      accepted_at: new Date().toISOString(),
    }));

    const { data: hold, error } = await context.supabase.rpc("hold_pod_enrollment", {
      _pod_id: data.podId,
      _commitments: commitments,
    });
    if (error) throw new Error(error.message || "Couldn't hold a seat.");

    const result = hold as {
      id?: string;
      status?: string;
      already_paid?: boolean;
    } | null;

    if (!result?.id) throw new Error("Couldn't hold a seat.");
    if (result.already_paid || result.status === "paid") {
      return { status: "already_paid" as const, enrollmentId: result.id };
    }

    const url = new URL(POD_PAYMENT_LINK);
    url.searchParams.set("client_reference_id", result.id);
    const email = (context.claims as { email?: string }).email;
    if (email) url.searchParams.set("prefilled_email", email);

    return { status: "ready" as const, url: url.toString(), enrollmentId: result.id };
  });
