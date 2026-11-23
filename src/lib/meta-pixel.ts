/** Browser-only Meta Pixel helpers. No-ops when `fbq` is unavailable. */

export const META_PIXEL_ID = "1124932263242636";

export type MembershipPixelKind = "monthly" | "founding";

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    /** Prevents double init/PageView when the head snippet runs twice (SSR + hydrate). */
    __okaMetaPixelBooted?: boolean;
  }
}

/** Meta base snippet: init + automatic first PageView. Inject via root head. */
export const META_PIXEL_BASE_SCRIPT = `
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
if(!window.__okaMetaPixelBooted){window.__okaMetaPixelBooted=true;fbq('init','${META_PIXEL_ID}');fbq('track','PageView');}
`.trim();

export function normalizeContentId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export function membershipContent(kind: MembershipPixelKind): {
  content_ids: [string];
  value: number;
  content_name: string;
} {
  if (kind === "founding") {
    return { content_ids: ["oka_founding_250"], value: 250, content_name: "Founding Membership" };
  }
  return { content_ids: ["oka_monthly_29"], value: 29, content_name: "Monthly Membership" };
}

export function eventContentId(joinSlugOrId: string): string {
  return `evt_${normalizeContentId(joinSlugOrId)}`;
}

export function facilitatorSlugFromName(displayName: string | null | undefined): string | undefined {
  if (!displayName?.trim()) return undefined;
  const id = normalizeContentId(displayName);
  return id || undefined;
}

function fbq(...args: unknown[]) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq(...args);
}

export function trackPageView() {
  fbq("track", "PageView");
}

export function trackViewContent(params: {
  content_category: string;
  content_ids: string[];
  content_name: string;
  content_type?: string;
  facilitator_slug?: string;
}) {
  fbq("track", "ViewContent", {
    content_category: params.content_category,
    content_ids: params.content_ids,
    content_name: params.content_name,
    content_type: params.content_type ?? "product",
    ...(params.facilitator_slug ? { facilitator_slug: params.facilitator_slug } : {}),
  });
}

export function trackCompleteRegistration(params: {
  content_category: string;
  content_ids: string[];
  content_name: string;
  status: string;
  facilitator_slug?: string;
}) {
  fbq("track", "CompleteRegistration", {
    content_category: params.content_category,
    content_ids: params.content_ids,
    content_name: params.content_name,
    status: params.status,
    ...(params.facilitator_slug ? { facilitator_slug: params.facilitator_slug } : {}),
  });
}

export function trackInitiateCheckout(kind: MembershipPixelKind) {
  const m = membershipContent(kind);
  fbq("track", "InitiateCheckout", {
    content_category: "membership",
    content_ids: m.content_ids,
    content_name: m.content_name,
    content_type: "product",
    value: m.value,
    currency: "USD",
  });
}

const purchaseFired = new Set<string>();

/** Fires once per Stripe session id (guards remount / double confirm). */
export function trackPurchase(kind: MembershipPixelKind, eventID: string) {
  if (!eventID || purchaseFired.has(eventID)) return;
  purchaseFired.add(eventID);
  const m = membershipContent(kind);
  fbq(
    "track",
    "Purchase",
    {
      content_category: "membership",
      content_ids: m.content_ids,
      content_name: m.content_name,
      content_type: "product",
      value: m.value,
      currency: "USD",
      num_items: 1,
    },
    { eventID },
  );
}

export function trackPlatformRegistration() {
  trackCompleteRegistration({
    content_category: "platform_registration",
    content_ids: ["oka_platform_signup"],
    content_name: "Oka Village Platform Registration",
    status: "completed",
  });
}

const viewedEvents = new Set<string>();

export function trackEventView(event: {
  join_slug: string;
  id: string;
  title: string;
  hostDisplayName?: string | null;
}) {
  if (!event.id || viewedEvents.has(event.id)) return;
  viewedEvents.add(event.id);
  const facilitator = facilitatorSlugFromName(event.hostDisplayName);
  trackViewContent({
    content_category: "facilitator_event",
    content_ids: [eventContentId(event.join_slug || event.id)],
    content_name: event.title,
    content_type: "product",
    facilitator_slug: facilitator,
  });
}

export function trackEventRegistration(event: {
  join_slug: string;
  id: string;
  title: string;
  hostDisplayName?: string | null;
}) {
  const facilitator = facilitatorSlugFromName(event.hostDisplayName);
  trackCompleteRegistration({
    content_category: "facilitator_event",
    content_ids: [eventContentId(event.join_slug || event.id)],
    content_name: event.title,
    status: "registered",
    facilitator_slug: facilitator,
  });
}
