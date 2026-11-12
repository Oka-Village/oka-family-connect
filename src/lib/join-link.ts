// Shareable event join links (/join/<slug>) and the "come back here after sign-in" memory.
// The link carries only the event's public slug — never a token. Access is still gated by RSVP.
import { PRODUCTION_ORIGIN } from "./affiliate-share";

const RETURN_KEY = "oka:return-to";

/** Path for an event join link; adds ?ref=<code> only when the sharer has an affiliate code. */
export function joinPath(slug: string, refCode?: string | null) {
  const ref = refCode?.trim();
  return ref ? `/join/${slug}?ref=${encodeURIComponent(ref)}` : `/join/${slug}`;
}

export function joinUrl(slug: string, refCode?: string | null) {
  return `${PRODUCTION_ORIGIN}${joinPath(slug, refCode)}`;
}

/** Sharing is available to every signed-in viewer of a published event. */
export function canShareEventLink(isSignedIn: boolean, status: string) {
  return isSignedIn && status === "published";
}

/** Remember a same-origin path to return to after the Google round-trip. */
export function saveReturnTo(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return;
  try { localStorage.setItem(RETURN_KEY, JSON.stringify({ path, at: Date.now() })); } catch { /* storage unavailable */ }
}

/** Read and clear the saved path (valid for 30 minutes). */
export function takeReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(RETURN_KEY);
    localStorage.removeItem(RETURN_KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path: string; at: number };
    if (Date.now() - at > 30 * 60_000 || !path.startsWith("/") || path.startsWith("//")) return null;
    return path;
  } catch {
    return null;
  }
}
