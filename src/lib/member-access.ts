export const FULL_ACCESS_OPENS_AT = "2026-12-01T00:00:00.000Z";
export type MemberStatus = "full" | "limited";

/** Matches public.is_full_member(): the soft-launch boundary is midnight UTC. */
export function isFullMember(profile: { member_status: MemberStatus } | null | undefined, now = new Date(), hasVerifiedPaymentAccess = false): boolean {
  return Boolean(profile && (profile.member_status === "full" || (profile.member_status === "limited" && hasVerifiedPaymentAccess && now.getTime() >= Date.parse(FULL_ACCESS_OPENS_AT))));
}

const ALLOWED_ROUTES = new Set(["/profile", "/onboarding", "/welcome", "/skills/new", "/houses/new", "/events", "/events/new", "/affiliate", "/privacy", "/terms"]);

export function ownEditTarget(pathname: string): { table: "skills" | "houses" | "events"; id: string } | null {
  const match = /^\/(skills|houses|events)\/edit\/([^/]+)$/.exec(pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const table = match[1];
  const id = match[2];
  if (!id || (table !== "skills" && table !== "houses" && table !== "events")) return null;
  return { table, id };
}

/** One skill or home page (not new/edit); limited members may open only their own. */
export function ownListingViewTarget(pathname: string): { table: "skills" | "houses"; id: string } | null {
  const match = /^\/(skills|houses)\/([^/]+)$/.exec(pathname.replace(/\/+$/, ""));
  if (!match?.[2] || match[2] === "new" || match[2] === "edit") return null;
  return { table: match[1] as "skills" | "houses", id: match[2] };
}

/** One event page, not the schedule. /events/new is a separate allow-list route. */
export function ownEventViewTarget(pathname: string): { id: string } | null {
  const match = /^\/events\/([^/]+)$/.exec(pathname.replace(/\/+$/, "") || "/");
  if (!match?.[1] || match[1] === "new") return null;
  return { id: match[1] };
}

/** The calendar's one-day list, /events/day/YYYY-MM-DD; open to every member. */
export function isEventDayRoute(pathname: string): boolean {
  return /^\/events\/day\/[^/]+$/.test(pathname.replace(/\/+$/, ""));
}

/** Propose, edit, or open one event, or a calendar day list. */
export function isEventProposalRoute(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/events/new" || isEventDayRoute(path) || Boolean(ownEditTarget(path)?.table === "events") || Boolean(ownEventViewTarget(path));
}

export function canAccessMemberRoute(pathname: string, fullAccess: boolean, ownsEdit = false, invitedToEvent = false): boolean {
  if (fullAccess) return true;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (ALLOWED_ROUTES.has(path)) return true;
  if (ownsEdit && (ownEditTarget(path) || ownEventViewTarget(path) || ownListingViewTarget(path))) return true;
  // The events schedule and every event page are open to all members; private locations stay gated in the database.
  void invitedToEvent;
  return Boolean(ownEventViewTarget(path)) || isEventDayRoute(path);
}