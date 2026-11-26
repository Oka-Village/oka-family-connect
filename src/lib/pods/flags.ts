/** Pods UI is off in production unless explicitly enabled after Stripe Payment Link metadata kind=pod is set. */
export const PODS_UI_ENABLED = import.meta.env.DEV || import.meta.env["VITE_PODS_UI"] === "true";
