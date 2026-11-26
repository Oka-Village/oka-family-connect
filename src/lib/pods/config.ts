/**
 * Override with POD_PAYMENT_LINK in .env.local for Stripe test links; default stays live.
 * Dashboard one-time: set Payment Link metadata kind=pod (and a description containing “Pod”)
 * before enabling VITE_PODS_UI in production.
 */
export const POD_PAYMENT_LINK =
  process.env["POD_PAYMENT_LINK"] ?? "https://buy.stripe.com/4gMaEW3MIgbnakz9bodjO02";

export const POD_PRICE_CENTS = 17500; // $175
