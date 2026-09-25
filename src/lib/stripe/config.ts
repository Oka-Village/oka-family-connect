/**
 * Central Stripe configuration seam.
 *
 * No keys live here and no Stripe calls are made yet. When the keys arrive
 * they are added as backend secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
 * and the scaffold in ./checkout.functions.ts starts working without any
 * refactor of the calling code.
 */

export type StripeProduct = "pod" | "membership_annual" | "membership_monthly";

export type StripeProductConfig = {
  /** Matches payments.purpose in the database. */
  purpose: StripeProduct;
  label: string;
  amountCents: number;
  currency: string;
  mode: "payment" | "subscription";
  /** Whether Stripe promotion codes may be applied at checkout. */
  allowPromotionCodes: boolean;
};

export const STRIPE_PRODUCTS: Record<StripeProduct, StripeProductConfig> = {
  pod: {
    purpose: "pod",
    label: "Oka Pod",
    amountCents: 50000, // $500
    currency: "usd",
    mode: "payment",
    allowPromotionCodes: true,
  },
  membership_annual: {
    purpose: "membership_annual",
    label: "Full membership (annual)",
    amountCents: 99900, // $999 / year
    currency: "usd",
    mode: "subscription",
    allowPromotionCodes: true,
  },
  membership_monthly: {
    purpose: "membership_monthly",
    label: "Full membership (monthly)",
    amountCents: 9900,
    currency: "usd",
    mode: "subscription",
    allowPromotionCodes: true,
  },
};

/** Secret names expected in the backend secret store. Unset for now. */
export const STRIPE_SECRET_NAMES = {
  secretKey: "STRIPE_SECRET_KEY",
  webhookSecret: "STRIPE_WEBHOOK_SECRET",
} as const;
