import { TRIAL_DAYS } from "./onboarding-rules";

export const TRIAL_ACCESS_LAUNCH_AT = "2026-12-01T00:00:00.000Z";
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialState = "none" | "active" | "expired";

/**
 * An admin end date overrides the standard trial, including an immediate end.
 * Otherwise pre-launch trials count from launch; later trials count from start.
 */
export function trialEndDate(
  trialStartedAt: string | null | undefined,
  trialEndsAt?: string | null,
): Date | null {
  if (trialEndsAt != null) {
    const customEnd = Date.parse(trialEndsAt);
    return Number.isNaN(customEnd) ? null : new Date(customEnd);
  }
  if (!trialStartedAt) return null;
  const started = Date.parse(trialStartedAt);
  if (Number.isNaN(started)) return null;
  const effectiveStart = Math.max(started, Date.parse(TRIAL_ACCESS_LAUNCH_AT));
  return new Date(effectiveStart + TRIAL_DAYS * DAY_MS);
}

export function trialState(
  trialStartedAt: string | null | undefined,
  now = new Date(),
  trialEndsAt?: string | null,
): TrialState {
  const end = trialEndDate(trialStartedAt, trialEndsAt);
  if (!end) return "none";
  return now.getTime() < end.getTime() ? "active" : "expired";
}

/** Add days to the current effective end, or to now when no trial is active. */
export function extendTrialEnd(
  trialStartedAt: string | null | undefined,
  trialEndsAt: string | null | undefined,
  days: number,
  now = new Date(),
): string {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Trial extensions must be between 1 and 365 days.");
  const currentEnd = trialEndDate(trialStartedAt, trialEndsAt);
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd.getTime() : now.getTime();
  return new Date(base + days * DAY_MS).toISOString();
}
