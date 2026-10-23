// Browser-safe: keeps a signed-out member's plan choice across the Google sign-in round-trip.
export type IntentKind = "founding" | "monthly";
export type MembershipIntent = { kind: IntentKind; agreed: boolean };

const KEY = "oka:membership-intent";

export function parseIntent(raw: string | null | undefined): MembershipIntent | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<MembershipIntent>;
    if (v.kind !== "founding" && v.kind !== "monthly") return null;
    return { kind: v.kind, agreed: v.agreed === true };
  } catch { return null; }
}

/** URL param wins for the kind; terms acceptance only ever comes from what was stored before sign-in. */
export function resolveIntent(paramKind: IntentKind | undefined, stored: MembershipIntent | null): MembershipIntent | null {
  if (paramKind) return { kind: paramKind, agreed: stored?.kind === paramKind ? stored.agreed : false };
  return stored;
}

export function saveIntent(intent: MembershipIntent) {
  try { sessionStorage.setItem(KEY, JSON.stringify(intent)); } catch { /* storage unavailable */ }
}
export function readIntent(): MembershipIntent | null {
  try { return parseIntent(sessionStorage.getItem(KEY)); } catch { return null; }
}
export function clearIntent() {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
