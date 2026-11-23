import { supabase } from "@/integrations/supabase/client";
import { reconcileOpenAccounting, type StripeCheck } from "@/lib/stripe/reconcile.functions";
import type {
  AccountingData,
  CreditReasonRow,
  EarnerInput,
  LedgerRow,
  MonthInput,
  OwnershipRow,
  ParticipationHome,
  ParticipationSkill,
  TodaySlice,
} from "./views";

export type { AccountingData };

type RawOwnershipRow = { group: string; unitsCount: number; percentage: number; isVerified: boolean };

type RawPayload = {
  months: MonthInput[];
  earners: EarnerInput[];
  ledger: LedgerRow[];
  ownership: RawOwnershipRow[];
  today: TodaySlice | null;
  openingCashCents?: number;
  homes?: ParticipationHome[];
  skills?: ParticipationSkill[];
  creditReasons?: CreditReasonRow[];
};

function toOwnershipRow(row: RawOwnershipRow): OwnershipRow {
  return {
    name: row.group,
    share: `${Number(row.percentage)}%`,
    units: Number(row.unitsCount).toLocaleString("en-US"),
    status: row.isVerified ? "Verified" : "Draft",
  };
}

function withCashDefaults(month: MonthInput): MonthInput {
  return {
    ...month,
    monthlyCashCents: month.monthlyCashCents ?? 0,
    annualCashCents: month.annualCashCents ?? 0,
    lifetimeCashCents: month.lifetimeCashCents ?? 0,
    mrrCents: month.mrrCents ?? 0,
    expenses: month.expenses ?? {},
    budgets: month.budgets ?? {},
  };
}

async function earliestMonthId(): Promise<string> {
  const { data } = await supabase.from("profiles").select("created_at").order("created_at", { ascending: true }).limit(1).maybeSingle();
  const createdAt = data?.created_at ? new Date(data.created_at) : new Date();
  return `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Brings recorded figures up to date: checks Stripe (throttled server-side)
 * and re-runs the database syncs. Runs in the background so the Books render
 * from the latest saved figures immediately; callers refetch afterwards. */
export async function refreshAccountingSources(): Promise<StripeCheck> {
  let stripeCheck: StripeCheck = { checkedAt: null, unmatched: 0, ok: false };
  try {
    stripeCheck = await reconcileOpenAccounting();
  } catch {
    // Show recorded figures if the Stripe check is unavailable.
  }
  await supabase.rpc("sync_open_accounting");
  return stripeCheck;
}

/** Reads every real number the Open Accounting Books tab needs from the
 * saved figures. Cash figures come from payments.amount_cents. */
export async function fetchAccountingData(): Promise<AccountingData> {
  const startMonth = await earliestMonthId();
  const { data, error } = await supabase.rpc("open_accounting_raw", { p_start_month: startMonth });
  if (error) throw error;
  const raw = (data ?? {
    months: [],
    earners: [],
    ledger: [],
    ownership: [],
    today: null,
    openingCashCents: 0,
    homes: [],
    skills: [],
    creditReasons: [],
  }) as RawPayload;

  const months = (raw.months ?? []).map(withCashDefaults);
  if (raw.today && months.length > 0) {
    months[months.length - 1] = { ...months[months.length - 1]!, today: raw.today };
  }

  return {
    months,
    earners: raw.earners ?? [],
    ledger: raw.ledger ?? [],
    ownership: (raw.ownership ?? []).map(toOwnershipRow),
    openingCashCents: Number(raw.openingCashCents ?? 0),
    homes: raw.homes ?? [],
    skills: raw.skills ?? [],
    creditReasons: raw.creditReasons ?? [],
  };
}

export function historyYears(months: MonthInput[]): number[] {
  const years = new Set(months.map((month) => Number(month.id.slice(0, 4))));
  return [...years].sort((a, b) => a - b);
}
