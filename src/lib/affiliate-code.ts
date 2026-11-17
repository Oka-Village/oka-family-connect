export type AffiliateCodeRecord = { invite_code: string; status: string };

/** Never replace an existing code or reactivate a paused affiliate. */
export async function ensureActiveInviteCode({ read, activate }: {
  read: () => Promise<AffiliateCodeRecord | null>;
  activate: () => Promise<void>;
}): Promise<string | null> {
  let affiliate = await read();
  if (!affiliate) {
    await activate();
    affiliate = await read();
    if (!affiliate) throw new Error("Couldn't prepare your invitation link. Please try again.");
  }
  return affiliate.status === "active" ? affiliate.invite_code : null;
}