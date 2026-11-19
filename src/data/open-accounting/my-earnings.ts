import { supabase } from "@/integrations/supabase/client";
import { inviteUrl } from "@/lib/affiliate-share";
import { reconcileOpenAccounting } from "@/lib/stripe/reconcile.functions";
import {
  canFollowUp,
  monthLabel,
  netBalance,
  nextPayout,
  statusLabel,
  type BalanceView,
  type MembershipStatus,
} from "@/lib/open-accounting/allocate";

export type EarningsInvite = {
  id: string;
  firstName: string;
  registered: string;
  status: MembershipStatus;
  membershipType: string | null;
  lastPayment: string | null;
  earnedCents: number;
  pendingCents: number;
};

export type EarningsStatementRow = {
  id: string;
  date: string;
  reason: string;
  cents: number;
  kind: "advance" | "deduction" | "credit";
  reference: string | null;
};

export type EarningsEvent = {
  id: string;
  name: string;
  date: string;
  number: string;
  eventStatus: string;
  status: string;
  registered: number;
  verified: number;
  points: number;
  earningsCents: number;
};

export type EarningsPayout = {
  id: string;
  date: string;
  covers: string;
  cents: number;
  status: string;
  method: string | null;
};

export type EarningsMonthPoint = {
  id: string;
  label: string;
  referralCents: number;
  contributionCents: number;
  invitedCount: number;
  payingCount: number;
};

export type EarningsAffiliate = {
  id: string;
  inviteCode: string;
  status: string;
  commissionPct: number;
  url: string;
} | null;

export type MemberEarningsAccount = {
  affiliate: EarningsAffiliate;
  invites: EarningsInvite[];
  statement: EarningsStatementRow[];
  events: EarningsEvent[];
  payouts: EarningsPayout[];
  monthSeries: EarningsMonthPoint[];
  referralCents: number;
  contributionCents: number;
  earnedCents: number;
  adjustmentCents: number;
  paidCents: number;
  pendingCents: number;
  balance: BalanceView;
  nextPayout: ReturnType<typeof nextPayout>;
  paymentMethod: string | null;
};

type RawInvite = {
  id: string;
  firstName: string | null;
  registered: string;
  status: string;
  membershipType: string | null;
  lastPayment: string | null;
  earnedCents: number;
  pendingCents?: number;
};

type RawStatement = {
  id: string;
  date: string;
  reason: string;
  cents: number;
  kind: string;
  reference: string | null;
};

type RawEvent = {
  id: string;
  name: string;
  date: string;
  number: string;
  eventStatus?: string;
  status: string;
  registered?: number;
  verified: number;
  points: number;
  earningsCents: number;
};

type RawPayout = {
  id: string;
  date: string;
  covers: string;
  cents: number;
  status: string;
  method?: string | null;
};

type RawMonth = {
  id: string;
  referralCents: number;
  contributionCents: number;
  invitedCount: number;
  payingCount: number;
};

type RawTotals = {
  referralCents?: number;
  contributionCents?: number;
  pendingCents?: number;
  paidCents?: number;
  creditsCents?: number;
  advancesCents?: number;
  deductionsCents?: number;
};

type RawPayoutMethod = {
  methodType?: string;
  bankName?: string | null;
  accountLast4?: string | null;
} | null;

type RawPayload = {
  invites?: RawInvite[];
  statement?: RawStatement[];
  totals?: RawTotals;
  monthSeries?: RawMonth[];
  events?: RawEvent[];
  payouts?: RawPayout[];
  payoutMethod?: RawPayoutMethod;
};

function asMembershipStatus(value: string): MembershipStatus {
  if (value === "free-trial" || value === "active-paid" || value === "expired-trial" || value === "cancelled") {
    return value;
  }
  return "expired-trial";
}

function asStatementKind(value: string): EarningsStatementRow["kind"] | null {
  if (value === "advance" || value === "deduction" || value === "credit") return value;
  return null;
}

function formatPaymentMethod(row: RawPayoutMethod): string | null {
  if (!row?.methodType) return null;
  const bank = row.bankName?.trim() || row.methodType;
  return row.accountLast4 ? `${bank} ····${row.accountLast4}` : bank;
}

function payoutStatusLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "scheduled") return "Scheduled";
  if (status === "processing") return "Processing";
  if (status === "failed") return "Failed";
  return status;
}

/** Loads the caller's personal My Earnings view from live DB (Stripe-backed payments). */
export async function fetchMyEarnings(userId: string): Promise<MemberEarningsAccount> {
  // Stripe first: fix missing/changed payments before earnings are computed.
  try {
    await reconcileOpenAccounting();
  } catch {
    // Show recorded figures if the Stripe check is unavailable.
  }
  await supabase.rpc("sync_member_earnings");
  await supabase.rpc("sync_event_contributions");
  await supabase.rpc("schedule_member_payouts", {});

  const [rawResult, affiliateResult] = await Promise.all([
    supabase.rpc("my_earnings_raw"),
    supabase.from("affiliates").select("id,invite_code,status,commission_pct").eq("user_id", userId).maybeSingle(),
  ]);

  if (rawResult.error) throw rawResult.error;
  if (affiliateResult.error) throw affiliateResult.error;

  const raw = (rawResult.data ?? {}) as RawPayload;
  const totals = raw.totals ?? {};

  const invites: EarningsInvite[] = (raw.invites ?? []).map((invite) => ({
    id: invite.id,
    firstName: invite.firstName?.trim() || "Member",
    registered: invite.registered,
    status: asMembershipStatus(invite.status),
    membershipType: invite.membershipType,
    lastPayment: invite.lastPayment,
    earnedCents: Number(invite.earnedCents ?? 0),
    pendingCents: Number(invite.pendingCents ?? 0),
  }));

  const statement: EarningsStatementRow[] = (raw.statement ?? [])
    .map((row) => {
      const kind = asStatementKind(row.kind);
      if (!kind) return null;
      return {
        id: row.id,
        date: row.date,
        reason: row.reason,
        cents: Number(row.cents ?? 0),
        kind,
        reference: row.reference,
      };
    })
    .filter((row): row is EarningsStatementRow => row !== null);

  const events: EarningsEvent[] = (raw.events ?? []).map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date,
    number: event.number ?? "—",
    eventStatus: event.eventStatus ?? "",
    status: event.status,
    registered: Number(event.registered ?? 0),
    verified: Number(event.verified ?? 0),
    points: Number(event.points ?? 0),
    earningsCents: Number(event.earningsCents ?? 0),
  }));

  const payouts: EarningsPayout[] = (raw.payouts ?? []).map((payout) => ({
    id: payout.id,
    date: payout.date,
    covers: monthLabel(payout.covers) || payout.covers,
    cents: Number(payout.cents ?? 0),
    status: payoutStatusLabel(payout.status),
    method: payout.method ?? null,
  }));

  const monthSeries: EarningsMonthPoint[] = (raw.monthSeries ?? []).map((point) => ({
    id: point.id,
    label: monthLabel(point.id),
    referralCents: Number(point.referralCents ?? 0),
    contributionCents: Number(point.contributionCents ?? 0),
    invitedCount: Number(point.invitedCount ?? 0),
    payingCount: Number(point.payingCount ?? 0),
  }));

  const referralCents = Number(totals.referralCents ?? 0);
  const contributionCents = Number(totals.contributionCents ?? 0);
  const pendingCents = Number(totals.pendingCents ?? 0);
  const paidCents = Number(totals.paidCents ?? 0);
  const creditsCents = Number(totals.creditsCents ?? 0);
  const advancesCents = Number(totals.advancesCents ?? 0);
  const deductionsCents = Number(totals.deductionsCents ?? 0);
  const earnedCents = referralCents + contributionCents;

  const affiliateRow = affiliateResult.data;
  const affiliate: EarningsAffiliate = affiliateRow
    ? {
        id: affiliateRow.id,
        inviteCode: affiliateRow.invite_code,
        status: affiliateRow.status,
        commissionPct: Number(affiliateRow.commission_pct),
        url: inviteUrl(affiliateRow.invite_code),
      }
    : null;

  const balance = netBalance({
    approvedEarningsCents: earnedCents,
    creditsCents,
    advancesCents,
    deductionsCents,
    previousPayoutsCents: paidCents,
  });

  return {
    affiliate,
    invites,
    statement,
    events,
    payouts,
    monthSeries,
    referralCents,
    contributionCents,
    earnedCents,
    adjustmentCents: creditsCents - advancesCents - deductionsCents,
    paidCents,
    pendingCents,
    balance,
    nextPayout: nextPayout(),
    paymentMethod: formatPaymentMethod(raw.payoutMethod ?? null),
  };
}

export { canFollowUp, statusLabel };
