// Draft-only presentation rules; these do not create binding acceptance.
export const MINIMUM_FACILITATOR_SESSIONS = 3;
export const ELIGIBILITY_CONFIRMATION_COUNT = 5;
export const PAYMENT_CONFIRMATION_COUNT = 2;
export const AGREEMENT_CONFIRMATION_COUNT = 5;

export function defaultConfirmations(count: number, saved?: boolean[]): boolean[] {
  return Array.from({ length: count }, (_, i) => typeof saved?.[i] === "boolean" ? saved[i] : true);
}

export function requiredConfirmationsComplete(checks: boolean[], count: number): boolean {
  return checks.length === count && checks.every(Boolean);
}

export function validMinimumParticipants(value: string): boolean {
  const count = Number(value);
  return value.trim().length > 0 && Number.isSafeInteger(count) && count >= 1;
}