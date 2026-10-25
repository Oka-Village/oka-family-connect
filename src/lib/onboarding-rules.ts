/** Onboarding requirements are independent of payment and launch access. */
export function needsOnboardingPhoto(photo: string | null | undefined): boolean {
  return !photo?.trim();
}

export function showSupportOffer(paid: boolean, exempt: boolean, trialStartedAt: string | null | undefined = null): boolean {
  return !paid && !exempt && !trialStartedAt;
}

export const TRIAL_DAYS = 7;