/** Pods UI is enabled for everyone. Set VITE_PODS_UI=false to hide it again. */
export const PODS_UI_ENABLED = import.meta.env["VITE_PODS_UI"] !== "false";

/** Pod payments stay closed until the Stripe webhook is connected. Set VITE_POD_REGISTRATION=open to enable. */
export const PODS_REGISTRATION_OPEN = import.meta.env["VITE_POD_REGISTRATION"] === "open";
