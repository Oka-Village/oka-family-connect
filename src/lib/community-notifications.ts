import type { EventNotice } from "@/lib/event-notifications";

/** Browser-safe copy for payment, signup and referral alerts. */
export type PaymentPurpose = "membership_monthly" | "membership_annual" | "founding_lifetime" | "pod" | string;

export function planLabel(purpose: PaymentPurpose) {
  if (purpose === "founding_lifetime") return "Founding membership";
  if (purpose === "membership_monthly") return "Monthly membership";
  if (purpose === "membership_annual") return "Annual membership";
  if (purpose === "pod") return "Pod";
  return "Payment";
}

export function formatUsd(cents: number, currency = "usd") {
  return `${(cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() })} ${currency.toUpperCase()}`;
}

export type PaymentFacts = {
  memberName: string;
  memberEmail: string | null;
  purpose: PaymentPurpose;
  amountCents: number;
  currency: string;
  reference: string;
  referrer: string | null;
};

export function paymentSlackText(p: PaymentFacts) {
  return [
    `:moneybag: New ${planLabel(p.purpose)} payment`,
    `Member: ${p.memberName}${p.memberEmail ? ` (${p.memberEmail})` : ""}`,
    `Amount: ${formatUsd(p.amountCents, p.currency)}`,
    `Reference: ${p.reference}`,
    `Referred by: ${p.referrer ?? "—"}`,
  ].join("\n");
}

export function paymentAdminNotice(p: PaymentFacts, adminUrl: string): EventNotice {
  return {
    subject: `New ${planLabel(p.purpose)} payment — ${p.memberName}`,
    paragraphs: [
      `${p.memberName}${p.memberEmail ? ` (${p.memberEmail})` : ""} just completed a verified payment.`,
      `Plan: ${planLabel(p.purpose)}. Amount: ${formatUsd(p.amountCents, p.currency)}.`,
      `Reference: ${p.reference}. Referred by: ${p.referrer ?? "no one"}.`,
    ],
    links: [{ label: "Open admin", href: adminUrl }],
    kumoji: false,
  };
}

export function paymentMemberNotice(p: { firstName: string; purpose: PaymentPurpose; amountCents: number; currency: string; profileUrl: string }): EventNotice {
  return {
    subject: "Thank you — your payment is confirmed",
    paragraphs: [
      `Dear ${p.firstName},`,
      `We received your ${planLabel(p.purpose).toLowerCase()} payment of ${formatUsd(p.amountCents, p.currency)}. Thank you for supporting OneWorld Family.`,
      "Your membership is active and the whole community is open to you.",
    ],
    links: [{ label: "Go to your profile", href: p.profileUrl }],
    kumoji: true,
    mood: "joy",
  };
}

export const FOUNDING_BADGE_TITLE = "Your Founding Member badge is live";
export const FOUNDING_BADGE_BODY = "Your Founding Member badge is now visible on your profile. Thank you for being part of the foundation of OneWorld Family.";

export function foundingBadgeNotice(p: { firstName: string; profileUrl: string }): EventNotice {
  return {
    subject: FOUNDING_BADGE_TITLE,
    paragraphs: [`Dear ${p.firstName},`, FOUNDING_BADGE_BODY],
    links: [{ label: "See your profile", href: p.profileUrl }],
    kumoji: true,
  };
}

export function newMemberAdminNotice(p: { name: string; email: string | null; joinedAt: string; referrer: string | null; adminUrl: string }): EventNotice {
  return {
    subject: `New member registered — ${p.name}`,
    paragraphs: [
      `${p.name}${p.email ? ` (${p.email})` : ""} created an account.`,
      `Registered: ${new Date(p.joinedAt).toUTCString()}.`,
      `Referral source: ${p.referrer ? `invited by ${p.referrer}` : "direct signup"}.`,
    ],
    links: [{ label: "View members", href: p.adminUrl }],
    kumoji: false,
  };
}

export const REFERRAL_JOINED_TITLE = "Someone joined through your invitation";
export const REFERRAL_JOINED_BODY = "Someone joined OneWorld Family through your invitation. Thank you for helping our family grow.";

export function referralJoinedNotice(p: { firstName: string; earningsUrl: string }): EventNotice {
  return {
    subject: REFERRAL_JOINED_TITLE,
    paragraphs: [
      `Dear ${p.firstName},`,
      REFERRAL_JOINED_BODY,
      "This is a new registration — any earnings appear on My Earnings only once a paid membership is confirmed.",
    ],
    links: [{ label: "Open My Earnings", href: p.earningsUrl }],
    kumoji: true,
  };
}

export function referralRsvpBody(eventTitle: string) {
  return `Someone registered for ${eventTitle} through your invitation. Thank you for helping people discover meaningful experiences.`;
}

export function referralRsvpNotice(p: { firstName: string; eventTitle: string; eventUrl: string }): EventNotice {
  return {
    subject: `Someone registered for ${p.eventTitle} through your invitation`,
    paragraphs: [`Dear ${p.firstName},`, referralRsvpBody(p.eventTitle)],
    links: [{ label: "View the gathering", href: p.eventUrl }],
    kumoji: true,
  };
}
