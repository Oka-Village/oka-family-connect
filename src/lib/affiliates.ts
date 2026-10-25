import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { affiliateCreditCents } from "./affiliate-share";

/** localStorage key that carries an invite code through the Google sign-in round-trip. */
export const INVITE_KEY = "oka_invite_code";

export function saveInviteCode(code: string) {
  try { localStorage.setItem(INVITE_KEY, code.trim().toUpperCase().slice(0, 32)); } catch { /* storage blocked */ }
}

export function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/**
 * After sign-in, claim a stored invite code once. The database decides whether it
 * counts (new member, not self, not already referred); we only report the outcome.
 */
export function useClaimInvite(enabled: boolean) {
  const qc = useQueryClient();
  const ran = useRef(false);
  useEffect(() => {
    if (!enabled || ran.current) return;
    let code: string | null = null;
    try { code = localStorage.getItem(INVITE_KEY); } catch { return; }
    if (!code) return;
    ran.current = true;
    void supabase.rpc("claim_referral", { _code: code }).then(({ data, error }) => {
      if (error) { ran.current = false; return; } // keep the code and retry on next visit
      try { localStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
      if (data === "claimed") {
        toast.success("Welcome — you joined through a friend's invitation");
        void qc.invalidateQueries({ queryKey: ["affiliate"] });
      }
    });
  }, [enabled, qc]);
}

/**
 * Commission for one referral at a given rate: floor(PAID membership cents x pct / 100).
 * The page shows the fixed program share (AFFILIATE_SHARE_PCT) rather than each affiliate's
 * stored commission_pct; the database still records earned_cents at its own rate.
 */
export function commissionCents(paidMembershipCents: number, commissionPct: number) {
  return affiliateCreditCents(paidMembershipCents, commissionPct);
}
