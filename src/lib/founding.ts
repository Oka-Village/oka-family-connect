/** Founding member offer: one payment, membership for life. */
export const FOUNDING_PRICE_CENTS = 25000; // $250
export const FOUNDING_TERMS_VERSION = "2026-10-22";
/** Override with FOUNDING_PAYMENT_LINK in .env.local for Stripe test links; default stays live. */
export const FOUNDING_PAYMENT_LINK =
  process.env["FOUNDING_PAYMENT_LINK"] ?? "https://buy.stripe.com/3cIcN482Y3oB50fbjwdjO00";
