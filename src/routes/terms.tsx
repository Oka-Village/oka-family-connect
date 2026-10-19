import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";

import { LegalDraft, LegalPage, type LegalSection } from "@/components/oka/legal";

const DOMAIN = "https://oka-family-connect.lovable.app";
const SUPPORT = "daniel@zoe.garden";

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    heading: "The agreement",
    blocks: [
      {
        kind: "p",
        text: "By creating an Oka account you accept these terms. You must be 18 or over. If you use Oka on behalf of a household or a pod, you confirm that the people you speak for agree too.",
      },
    ],
  },
  {
    id: "what-oka-is",
    heading: "What Oka is, and what it is not",
    blocks: [
      {
        kind: "p",
        text: "Oka is social infrastructure for a chosen family: a place where members host each other and share what they can, measured in credits. One credit is one night's stay or one hour of service. Money never passes between members.",
      },
      {
        kind: "p",
        text: "Oka is not a hotel agency, a travel insurer, a bank, or an employer of the people you meet here. We build and look after the space; the hospitality itself is exchanged between members.",
      },
    ],
  },
  {
    id: "account",
    heading: "Your account",
    blocks: [
      {
        kind: "p",
        text: "You sign in with Google, and you keep one account in your own name with truthful details. Keep your Google account secure — you are responsible for what happens under your login. Tell us quickly if you think someone else has reached it.",
      },
    ],
  },
  {
    id: "membership",
    heading: "Membership and fees",
    blocks: [
      {
        kind: "p",
        text: "Some parts of Oka sit behind a membership. Prices are shown before you pay and are taken by Stripe. Where the law gives you a right to a refund, we honour it; otherwise, write to us before your renewal and we will find the fair answer.",
      },
      {
        kind: "p",
        text: "Facilitators must be members. The membership fee can be deducted from a facilitator's future earnings.",
      },
    ],
  },
  {
    id: "credits",
    heading: "Credits",
    blocks: [
      {
        kind: "p",
        text: "Credits are earned by hosting, by offering hours of your skill, and by contributing to the community. They are spent on stays and on hours of service. They have no cash value, are not money, e-money or an investment, cannot be bought or sold, and cannot be exchanged for anything outside Oka.",
      },
      {
        kind: "p",
        text: "Your balance is read from a record of entries that we never edit in place. If an entry is wrong, staff correct it by adding a new entry with a reason, so the history stays honest.",
      },
    ],
  },
  {
    id: "hosts",
    heading: "Hosting a stay",
    blocks: [
      {
        kind: "p",
        text: "If you open a home, you must be entitled to host it, and you agree to describe it truthfully: sleeping arrangements, house rules, capacity, availability, and anything a guest should know before arriving. You are responsible for keeping the space safe and lawful, and for the rules you set.",
      },
    ],
  },
  {
    id: "guests",
    heading: "Staying with someone",
    blocks: [
      {
        kind: "p",
        text: "As a guest you are a visitor in someone's home. Follow their house rules, respect the space and the people in it, arrive roughly when you said you would, and speak up early if plans change. Capacity and waitlist rules exist so nobody is turned away at the door — please honour them.",
      },
    ],
  },
  {
    id: "sessions",
    heading: "Sessions, skills and facilitators",
    blocks: [
      {
        kind: "p",
        text: "People who offer sessions are responsible for their own competence and for any licence their field requires. Facilitators are independent, not employees of Oka, and we review applications without certifying anyone's qualifications.",
      },
      {
        kind: "p",
        text: "A facilitator commits to at least three sessions. If signups fall below the minimum they chose, they may reschedule and must tell the people registered. If a facilitator or a participant is unwell, the session can be moved with notice.",
      },
    ],
  },
  {
    id: "events",
    heading: "Events",
    blocks: [
      {
        kind: "p",
        text: "Member-proposed events are checked by staff before they appear. The exact location is shared only with people confirmed for the event, the host, and staff. If you can no longer come, cancel early so someone on the waitlist can take your place.",
      },
    ],
  },
  {
    id: "content",
    heading: "What you write",
    blocks: [
      {
        kind: "p",
        text: "You keep what you write. You give Oka permission to store and show it to the people you choose — a letter to the person you sent it to, a reflection to nobody but yourself. Letters can be read by staff if someone reports them.",
      },
      {
        kind: "p",
        text: "Do not post anything unlawful, threatening, harassing, or someone else's private information.",
      },
    ],
  },
  {
    id: "conduct",
    heading: "How members treat each other",
    blocks: [
      {
        kind: "p",
        text: "This only works with care. No harassment, discrimination, exploitation, or contact someone has not asked for. Respect consent and boundaries in a home and in a session. If something feels wrong, tell us — we would rather hear it early.",
      },
    ],
  },
  {
    id: "privacy-expectation",
    heading: "Respect what you learn",
    blocks: [
      {
        kind: "p",
        text: "An address, a health detail, a letter — these are shared with you for one reason. Use them for that reason only, and never collect or keep other members' information outside the app.",
      },
    ],
  },
  {
    id: "suspension",
    heading: "Pausing or removing an account",
    blocks: [
      {
        kind: "p",
        text: "Staff can pause an account, hide content, or remove it. A paused account sees a notice with a way to reach us rather than the app. A deleted account's email is blocked from registering again until we decide otherwise. You can always ask us to look at a decision again.",
      },
    ],
  },
  {
    id: "no-warranty",
    heading: "No promises we cannot keep",
    blocks: [
      {
        kind: "p",
        text: "Oka is provided as it is, working as well as we can make it. We do not promise that any member, host, or facilitator is suitable for you, and we do not check every claim made in the app. You decide who you stay with, who you invite in, and who you learn from.",
      },
    ],
  },
  {
    id: "safety",
    heading: "Meeting people safely",
    blocks: [
      {
        kind: "p",
        text: "Meet in a public place first where you can, tell someone where you are going, follow the law where you are, and trust your instincts. In an emergency, contact your local emergency services — Oka is not an emergency service.",
      },
    ],
  },
  {
    id: "liability",
    heading: "Responsibility",
    blocks: [
      {
        kind: "p",
        text: "To the fullest extent the law allows, Oka is not liable for indirect losses, nor for disputes between members, stays that go wrong, or sessions that fall short. Nothing here limits a liability that cannot lawfully be limited.",
      },
    ],
  },
  {
    id: "taxes",
    heading: "Fees and taxes",
    blocks: [
      {
        kind: "p",
        text: "If you earn through Oka, you are responsible for declaring and paying tax on what you earn, and for issuing the invoice your payment depends on.",
      },
    ],
  },
  {
    id: "law",
    heading: "Governing law",
    blocks: [
      {
        kind: "p",
        text: (
          <span>
            These terms are governed by the law of the country in which the Oka operator is
            registered, and the courts there have jurisdiction over disputes.
            <LegalDraft>governing law and operator entity</LegalDraft>
          </span>
        ),
      },
    ],
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    blocks: [
      {
        kind: "p",
        text: "We will tell you in the app or by email before a change that matters takes effect. Keeping on using Oka after that means you accept the new terms.",
      },
    ],
  },
];

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Oka · One World Family" },
      {
        name: "description",
        content:
          "The agreement between you and Oka: credits, hosting, sessions, conduct, and how accounts are looked after.",
      },
      { property: "og:title", content: "Terms of Service — Oka · One World Family" },
      {
        property: "og:description",
        content:
          "What you can expect from Oka and what we ask of you as a member, host, guest, or facilitator.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${DOMAIN}/terms` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${DOMAIN}/terms` }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      label="Terms"
      title="The agreement between us"
      intro="Written to be read. It sets out what you can expect from Oka and what we ask of you as a member, a host, a guest, or a facilitator."
      updated="19 October 2026"
      sections={SECTIONS}
      contact={
        <>
          <p className="section-label">Talk to us</p>
          <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
            Something here unclear, or a decision you would like looked at again? Write to
            the person who runs Oka.
          </p>
          <a
            href={`mailto:${SUPPORT}`}
            className="pill mt-5 inline-flex items-center gap-2 border border-sand text-foreground hover:bg-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Mail className="size-4 text-primary" strokeWidth={1.5} aria-hidden />
            {SUPPORT}
          </a>
        </>
      }
    />
  );
}
