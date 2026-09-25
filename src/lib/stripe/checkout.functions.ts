/**
 * Stripe checkout seam.
 *
 * Keys are not wired yet. This server function validates the request, checks
 * whether the Stripe secret is configured, and records the intent shape that
 * a real checkout session will later fill in. When STRIPE_SECRET_KEY exists,
 * only the marked block needs to be implemented - callers stay unchanged.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { STRIPE_PRODUCTS, STRIPE_SECRET_NAMES, type StripeProduct } from "./config";

const inputSchema = z.object({
  product: z.enum(["pod", "membership_annual", "membership_monthly"]),
  couponCode: z.string().trim().max(64).optional(),
});

export type CreateCheckoutResult =
  | { status: "not_configured"; product: StripeProduct; message: string }
  | { status: "ready"; product: StripeProduct; checkoutUrl: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<CreateCheckoutResult> => {
    const config = STRIPE_PRODUCTS[data.product];
    const secretKey = process.env[STRIPE_SECRET_NAMES.secretKey];

    if (!secretKey) {
      return {
        status: "not_configured",
        product: config.purpose,
        message: "Payments are not connected yet.",
      };
    }

    // TODO (payments phase): create the Stripe Checkout session here using
    // `config` (amount, currency, mode, allowPromotionCodes) and `data.couponCode`,
    // then insert a row into public.payments with the returned
    // stripe_checkout_session_id and status 'pending'.
    throw new Error("Stripe checkout is configured but not implemented yet.");
  });
