export const FULL_ACCESS_OPENS_AT = "2026-12-01T00:00:00.000Z";
export type MemberStatus = "full" | "limited";

/** Matches public.is_full_member(): the soft-launch boundary is midnight UTC. */
export function isFullMember(profile: { member_status: MemberStatus } | null | undefined, now = new Date(), hasVerifiedPaymentAccess = false): boolean {
  return Boolean(profile && (profile.member_status === "full" || (profile.member_status === "limited" && hasVerifiedPaymentAccess && now.getTime() >= Date.parse(FULL_ACCESS_OPENS_AT))));
}

const ALLOWED_ROUTES = new Set(["/profile", "/onboarding", "/welcome", "/skills/new", "/houses/new", "/events/new", "/affiliate", "/privacy", "/terms"]);

export function ownEditTarget(pathname: string): { table: "skills" | "houses" | "events"; id: string } | null {
  const match = /^\/(skills|houses|events)\/edit\/([^/]+)$/.exec(pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const table = match[1];
  const id = match[2];
  if (!id || (table !== "skills" && table !== "houses" && table !== "events")) return null;
  return { table, id };
}

export function canAccessMemberRoute(pathname: string, fullAccess: boolean, ownsEdit = false): boolean {
  if (fullAccess) return true;
  const path = pathname.replace(/\/+$/, "") || "/";
  return ALLOWED_ROUTES.has(path) || Boolean(ownsEdit && ownEditTarget(path));
}