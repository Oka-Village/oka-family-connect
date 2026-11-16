import { supabase } from "@/integrations/supabase/client";
import type { EarnerInput, LedgerRow, MonthInput, OwnershipRow, TodaySlice } from "./views";

export type AccountingData = {
  months: MonthInput[];
  earners: EarnerInput[];
  ledger: LedgerRow[];
  ownership: OwnershipRow[];
  openingCashCents: number;
};

type RawOwnershipRow = { group: string; unitsCount: number; percentage: number; isVerified: boolean };

type RawPayload = {
  months: MonthInput[];
  earners: EarnerInput[];
  ledger: LedgerRow[];
  ownership: RawOwnershipRow[];
  today: TodaySlice | null;
};

function toOwnershipRow(row: RawOwnershipRow): OwnershipRow {
  return {
    name: row.group,
    share: `${Number(row.percentage)}%`,
    units: Number(row.unitsCount).toLocaleString("en-US"),
    status: row.isVerified ? "Verified" : "Draft",
  };
}

async function earliestMonthId(): Promise<string> {
  const { data } = await supabase.from("profiles").select("created_at").order("created_at", { ascending: true }).limit(1).maybeSingle();
  const createdAt = data?.created_at ? new Date(data.created_at) : new Date();
  return `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Fetches every real number the Open Accounting Books tab needs, straight
 * from Supabase. Runs the sync functions first so referral/contribution
 * earnings reflect the latest real payments and events before reading. */
export async function fetchAccountingData(): Promise<AccountingData> {
  await supabase.rpc("sync_open_accounting");
  const startMonth = await earliestMonthId();
  const { data, error } = await supabase.rpc("open_accounting_raw", { p_start_month: startMonth });
  if (error) throw error;
  const raw = (data ?? { months: [], earners: [], ledger: [], ownership: [], today: null }) as RawPayload;

  const months = raw.months.map((month) => ({ ...month, expenses: month.expenses ?? {}, budgets: month.budgets ?? {} }));
  if (raw.today && months.length > 0) {
    months[months.length - 1] = { ...months[months.length - 1]!, today: raw.today };
  }

  return {
    months,
    earners: raw.earners ?? [],
    ledger: raw.ledger ?? [],
    ownership: (raw.ownership ?? []).map(toOwnershipRow),
    // No historical cash ledger exists anywhere in this app, so the earliest
    // tracked month starts at $0 — an explicit assumption, not a fabricated
    // figure. An admin can correct it once real opening cash is known.
    openingCashCents: 0,
  };
}

export function historyYears(months: MonthInput[]): number[] {
  const years = new Set(months.map((month) => Number(month.id.slice(0, 4))));
  return [...years].sort((a, b) => a - b);
}
