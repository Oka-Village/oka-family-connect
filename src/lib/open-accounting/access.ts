/** Open Accounting books: open to every signed-in member. */
export function canViewOpenAccountingBooks(_input?: {
  isStaff?: boolean;
  paid?: boolean;
  trialStartedAt?: string | null;
  membership?: { active: boolean; kind: string; current_period_end?: string | null } | null;
  now?: Date;
}): boolean {
  return true;
}
