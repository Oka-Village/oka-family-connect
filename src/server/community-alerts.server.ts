/**
 * Payment, signup and referral alerts. Every send is best-effort: failures are
 * logged and never break the payment or signup that triggered them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PRODUCTION_ORIGIN } from "@/lib/affiliate-share";
import {
  FOUNDING_BADGE_BODY, FOUNDING_BADGE_TITLE, REFERRAL_JOINED_BODY, REFERRAL_JOINED_TITLE,
  foundingBadgeNotice, newMemberAdminNotice, paymentAdminNotice, paymentMemberNotice, paymentSlackText,
  planLabel, referralJoinedNotice, referralRsvpBody, referralRsvpNotice, type PaymentFacts,
} from "@/lib/community-notifications";
import { firstNameFromDisplayName, type EventNotice } from "@/lib/event-notifications";
import { sendResendEmail } from "@/server/email.server";
import { sendSlackEventAlert } from "@/server/slack.server";

function db() {
  return supabaseAdmin as unknown as SupabaseClient;
}

async function profileName(userId: string) {
  const { data } = await db().from("profiles").select("display_name, created_at").eq("id", userId).maybeSingle();
  const row = data as { display_name?: string | null; created_at?: string } | null;
  return { name: row?.display_name?.trim() || "A new member", createdAt: row?.created_at ?? new Date().toISOString() };
}

async function emailOf(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  return error ? null : data.user?.email ?? null;
}

async function staffIds() {
  const { data } = await db().from("user_roles").select("user_id").in("role", ["admin", "moderator"]);
  return [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
}

async function referrerOf(userId: string) {
  const { data } = await db().from("affiliate_referrals").select("affiliate_id, affiliates(user_id)").eq("referred_user_id", userId).maybeSingle();
  const ownerId = (data as { affiliates?: { user_id?: string } | null } | null)?.affiliates?.user_id ?? null;
  if (!ownerId) return null;
  return { userId: ownerId, name: (await profileName(ownerId)).name };
}

async function safe(label: string, run: () => Promise<unknown>) {
  try { await run(); } catch (error) { console.error(`[community-alerts] ${label} failed`, error); }
}

/** Returns true only for the first caller with this (user, type, link) — the dedupe key. */
async function inAppOnce(userId: string, type: string, title: string, body: string, link: string) {
  const { count } = await db().from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("type", type).eq("link", link);
  if ((count ?? 0) > 0) return false;
  const { error } = await db().from("notifications").insert({ user_id: userId, type, title, body, link });
  if (error) { console.error("[community-alerts] notification insert failed", error.message); return false; }
  return true;
}

async function emailStaff(notice: EventNotice) {
  const ids = await staffIds();
  const addresses = (await Promise.all(ids.map(emailOf))).filter((e): e is string => Boolean(e));
  if (!addresses.length && process.env["ADMIN_NOTIFICATION_EMAIL"]) addresses.push(process.env["ADMIN_NOTIFICATION_EMAIL"]);
  for (const to of addresses) await sendResendEmail({ to, notice });
}

type PaymentRow = { id: string; user_id: string; amount_cents: number | null; currency: string; purpose: string; status: string; metadata: Record<string, unknown> | null; stripe_checkout_session_id: string | null; stripe_payment_intent_id: string | null };

/**
 * Announce a verified paid payment exactly once (#18, #21, #22, #23).
 * The claim marker lives on the payment row so the webhook and the
 * checkout-return verifier cannot both send.
 */
export async function announcePayment(lookup: { sessionId?: string | null; paymentIntent?: string | null }) {
  await safe("payment", async () => {
    let query = db().from("payments").select("id,user_id,amount_cents,currency,purpose,status,metadata,stripe_checkout_session_id,stripe_payment_intent_id");
    if (lookup.sessionId) query = query.eq("stripe_checkout_session_id", lookup.sessionId);
    else if (lookup.paymentIntent) query = query.eq("stripe_payment_intent_id", lookup.paymentIntent);
    else return;
    const { data } = await query.eq("status", "paid").limit(1).maybeSingle();
    const payment = data as PaymentRow | null;
    if (!payment || payment.metadata?.["alerts_sent_at"]) return;

    const metadata = { ...(payment.metadata ?? {}), alerts_sent_at: new Date().toISOString() };
    const { data: claimed } = await db().from("payments").update({ metadata })
      .eq("id", payment.id).is("metadata->>alerts_sent_at", null).select("id");
    if (!claimed?.length) return;

    const [{ name }, email, referrer] = await Promise.all([profileName(payment.user_id), emailOf(payment.user_id), referrerOf(payment.user_id)]);
    const facts: PaymentFacts = {
      memberName: name, memberEmail: email, purpose: payment.purpose, amountCents: payment.amount_cents ?? 0,
      currency: payment.currency || "usd", reference: payment.stripe_checkout_session_id ?? payment.stripe_payment_intent_id ?? payment.id,
      referrer: referrer?.name ?? null,
    };
    const profileUrl = `${PRODUCTION_ORIGIN}/profile`;
    const firstName = firstNameFromDisplayName(name);

    await safe("payment slack", () => sendSlackEventAlert(paymentSlackText(facts)));
    await safe("payment admin email", () => emailStaff(paymentAdminNotice(facts, `${PRODUCTION_ORIGIN}/admin`)));
    if (email) await safe("payment member email", () => sendResendEmail({ to: email, notice: paymentMemberNotice({ firstName, purpose: facts.purpose, amountCents: facts.amountCents, currency: facts.currency, profileUrl }) }));
    await safe("payment in-app", () => inAppOnce(payment.user_id, "payment_confirmed", "Your payment is confirmed",
      `Thank you — your ${planLabel(facts.purpose).toLowerCase()} payment was received.`, `/profile#payment-${payment.id}`));

    if (payment.purpose === "founding_lifetime") {
      const first = await inAppOnce(payment.user_id, "founding_badge", FOUNDING_BADGE_TITLE, FOUNDING_BADGE_BODY, "/profile");
      if (first && email) await safe("founding email", () => sendResendEmail({ to: email, notice: foundingBadgeNotice({ firstName, profileUrl }) }));
    }
  });
}

/** New registration (#1) and referral signup (#14). Only accounts created in the last 7 days qualify. */
export async function announceSignup(userId: string) {
  await safe("signup", async () => {
    const { name, createdAt } = await profileName(userId);
    if (Date.now() - new Date(createdAt).getTime() > 7 * 24 * 60 * 60 * 1000) return;
    const [email, referrer] = await Promise.all([emailOf(userId), referrerOf(userId)]);

    const staff = await staffIds();
    let first = false;
    for (const id of staff) {
      const fresh = await inAppOnce(id, "new_member", `New member: ${name}`, referrer ? `Invited by ${referrer.name}` : "Direct signup", `/members/${userId}`);
      first = first || fresh;
    }
    if (first) await safe("signup admin email", () => emailStaff(newMemberAdminNotice({ name, email, joinedAt: createdAt, referrer: referrer?.name ?? null, adminUrl: `${PRODUCTION_ORIGIN}/admin?tab=members` })));

    if (referrer && referrer.userId !== userId) {
      const fresh = await inAppOnce(referrer.userId, "referral_joined", REFERRAL_JOINED_TITLE, REFERRAL_JOINED_BODY, `/earnings#joined-${userId}`);
      const to = fresh ? await emailOf(referrer.userId) : null;
      if (to) await sendResendEmail({ to, notice: referralJoinedNotice({ firstName: firstNameFromDisplayName(referrer.name), earningsUrl: `${PRODUCTION_ORIGIN}/earnings` }) });
    }
  });
}

/** Event RSVP through someone's personal link (#15). The caller must already be going. */
export async function announceReferralRsvp(input: { userId: string; eventId: string; code: string }) {
  await safe("referral rsvp", async () => {
    const { data: aff } = await db().from("affiliates").select("user_id").eq("invite_code", input.code.trim().toUpperCase()).eq("status", "active").maybeSingle();
    const ownerId = (aff as { user_id?: string } | null)?.user_id;
    if (!ownerId || ownerId === input.userId) return;
    const { data: rsvp } = await db().from("event_rsvps").select("status").eq("event_id", input.eventId).eq("user_id", input.userId).maybeSingle();
    if (!rsvp || !["going", "waitlist"].includes((rsvp as { status: string }).status)) return;
    const { data: ev } = await db().from("events").select("title").eq("id", input.eventId).maybeSingle();
    const title = (ev as { title?: string } | null)?.title ?? "a gathering";
    const fresh = await inAppOnce(ownerId, "referral_rsvp", "Someone registered through your invitation", referralRsvpBody(title), `/events/${input.eventId}#rsvp-${input.userId}`);
    if (!fresh) return;
    const to = await emailOf(ownerId);
    if (to) await sendResendEmail({ to, notice: referralRsvpNotice({ firstName: firstNameFromDisplayName((await profileName(ownerId)).name), eventTitle: title, eventUrl: `${PRODUCTION_ORIGIN}/events/${input.eventId}` }) });
  });
}
