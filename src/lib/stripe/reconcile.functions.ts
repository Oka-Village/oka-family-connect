import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StripeCheck = { checkedAt: string | null; unmatched: number; ok: boolean };

const THROTTLE_MS = 5 * 60 * 1000;

/** Checks recorded payments against Stripe (at most every 5 minutes) before Open Accounting reads them. */
export const reconcileOpenAccounting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<StripeCheck> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: last } = await supabaseAdmin.from("stripe_reconciliation_runs").select("last_run_at, summary").eq("id", 1).maybeSingle();
    const lastSummary = (last?.summary ?? {}) as { unmatched?: number; ok?: boolean };
    if (last && Date.now() - new Date(last.last_run_at).getTime() < THROTTLE_MS) {
      return { checkedAt: last.last_run_at, unmatched: lastSummary.unmatched ?? 0, ok: lastSummary.ok ?? true };
    }
    // Claim the run first so parallel page loads don't all call Stripe.
    const now = new Date().toISOString();
    await supabaseAdmin.from("stripe_reconciliation_runs").upsert({ id: 1, last_run_at: now, summary: last?.summary ?? {} });
    try {
      const { reconcileWithStripe } = await import("./reconcile.server");
      const summary = await reconcileWithStripe(supabaseAdmin);
      await supabaseAdmin.from("stripe_reconciliation_runs").upsert({ id: 1, last_run_at: summary.checkedAt, summary });
      return { checkedAt: summary.checkedAt, unmatched: summary.unmatched, ok: true };
    } catch (error) {
      console.error("Open Accounting Stripe reconciliation failed", error instanceof Error ? error.message : error);
      await supabaseAdmin.from("stripe_reconciliation_runs").upsert({ id: 1, last_run_at: last?.last_run_at ?? now, summary: { ...lastSummary, ok: false } });
      return { checkedAt: last?.last_run_at ?? null, unmatched: lastSummary.unmatched ?? 0, ok: false };
    }
  });
