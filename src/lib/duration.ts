/**
 * Session length, always spoken in minutes: 60 → "60 minutes".
 * Browser-safe (no backend imports) so it can be tested directly.
 */
export function formatDuration(min: number | null) {
  if (!min) return null;
  return `${min} minute${min === 1 ? "" : "s"}`;
}
