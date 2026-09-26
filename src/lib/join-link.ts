// Shareable event join links (/join/<slug>) and the "come back here after sign-in" memory.
// The link carries only the event's public slug — never a token. Access is still gated by RSVP.

const RETURN_KEY = "oka:return-to";

export function joinUrl(slug: string) {
  return `${window.location.origin}/join/${slug}`;
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
