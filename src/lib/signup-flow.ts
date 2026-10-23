export const SIGNUP_FLOW_MAX_AGE_MS = 60 * 60 * 1000;

/** Only accounts created after the server issued this signup attempt are new. */
export function isNewFlowAccount(createdAt: string, startedAt: number, now: number): boolean {
  const created = Date.parse(createdAt);
  return Number.isFinite(startedAt) && startedAt > 0 && startedAt <= now
    && now - startedAt <= SIGNUP_FLOW_MAX_AGE_MS
    && Number.isFinite(created) && created >= startedAt && created <= now;
}