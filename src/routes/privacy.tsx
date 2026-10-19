import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";

import { LegalPage, type LegalSection } from "@/components/oka/legal";

const DOMAIN = "https://oka-family-connect.lovable.app";
const SUPPORT = "daniel@zoe.garden";

const SECTIONS: LegalSection[] = [
  {
    id: "who",
    heading: "Who we are",
    blocks: [
      {
        kind: "p",
        text: "Oka — One World Family is a community where people host each other at home and share their skills, exchanged in credits and never in money. We run the app, and we are responsible for the personal data described in this policy. You can reach us any time at " +
          SUPPORT +
          ".",
      },
    ],
  },
  {
    id: "google",
    heading: "Signing in with Google",
    blocks: [
      {
        kind: "p",
        text: "When you choose Continue with Google, Google shares your name, email address and profile photo with us. We never see or store your Google password. You can revoke Oka's access from your Google account at any time, and you can ask us to delete your account.",
      },
    ],
  },
  {
    id: "you-give",
    heading: "What you give us",
    blocks: [
      { kind: "p", text: "Only what you choose to add or create:" },
      {
        kind: "list",
        items: [
          "Profile details: display name, photo, city and country, what you do, age range, relationship status, what you are seeking and what you offer, the skills you list, the homes you open.",
          "What you write and do in the app: reflections, appreciation letters, favourites, event registrations, stay requests, credit activity.",
          "Anything you send us when you ask for help or report a problem.",
        ],
      },
    ],
  },
  {
    id: "automatic",
    heading: "What is kept automatically",
    blocks: [
      {
        kind: "p",
        text: "We keep the small amounts of data needed to keep you signed in and the app working, and we store simple preferences on your own device so the app remembers things between visits. The onboarding chat you may see before joining keeps your answers in your browser only — nothing is written to your profile from it.",
      },
    ],
  },
  {
    id: "members-see",
    heading: "What other members can see",
    blocks: [
      {
        kind: "p",
        text: "The Members directory shows only the parts of a profile that are set to be public. Beyond that, visibility is deliberately narrow:",
      },
      {
        kind: "list",
        items: [
          "The exact location of an event or home is shown only to people confirmed for it, the host, and our staff.",
          "An appreciation letter can be read only by you and the person you sent it to.",
          "Your written reflections are visible only to you. Our team cannot read them.",
        ],
      },
    ],
  },
  {
    id: "rooms",
    heading: "Online event rooms",
    blocks: [
      {
        kind: "p",
        text: "When you join a virtual event, your camera and microphone are used for the length of that room through our video provider, Daily. Oka does not record rooms.",
      },
    ],
  },
  {
    id: "payments",
    heading: "Payments and Invite & Earn",
    blocks: [
      {
        kind: "p",
        text: "Membership and pod fees are taken by Stripe, our payment processor. We keep a record of what you paid, when, and for what — never your full card number. If you invite friends, we link their purchases to your invite code so we can calculate the commission you are owed.",
      },
    ],
  },
  {
    id: "credits",
    heading: "Credits",
    blocks: [
      {
        kind: "p",
        text: "One credit is one night's stay or one hour of service. Money never moves between members. Your balance is read from an append-only record of credit entries, so a balance can always be traced back to the stays and hours behind it. Nobody, including us, can quietly edit a past entry.",
      },
    ],
  },
  {
    id: "not-do",
    heading: "What we do not do",
    blocks: [
      {
        kind: "p",
        text: "We do not sell your personal data, we do not run advertising trackers in the app, and we do not hand your data over to third parties except the providers that keep Oka running (hosting, video, payments, email) or where the law genuinely requires it.",
      },
    ],
  },
  {
    id: "moderation",
    heading: "Keeping the circle safe",
    blocks: [
      {
        kind: "p",
        text: "Our staff review proposed events before they appear, can act on a reported message, and can pause or remove an account. A suspended account sees a short notice with a way to contact us rather than the app itself. If an account is deleted, the email address is blocked from registering again until we choose to unblock it.",
      },
    ],
  },
  {
    id: "storage",
    heading: "Where your data lives",
    blocks: [
      {
        kind: "p",
        text: "Oka runs on secure cloud hosting in the United States. Access is limited to the people who need it to run the service, and our providers are bound to keep what they process confidential.",
      },
    ],
  },
  {
    id: "choices",
    heading: "Your choices",
    blocks: [
      {
        kind: "p",
        text: "You can change or remove most of what you have shared at any time from your profile. If you want your account deleted, write to us at " +
          SUPPORT +
          " and we will remove your profile, your event registrations, and the letters you sent or received. We keep only what we are legally obliged to keep, such as payment records.",
      },
    ],
  },
  {
    id: "children",
    heading: "Adults only",
    blocks: [
      {
        kind: "p",
        text: "Oka is for people aged 18 and over. If we learn that a child has an account, we delete it.",
      },
    ],
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    blocks: [
      {
        kind: "p",
        text: "If we change this policy in a way that matters to you, we will tell you in the app or by email before it takes effect. The date at the top always shows the version you are reading.",
      },
    ],
  },
];

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Oka · One World Family" },
      {
        name: "description",
        content:
          "What Oka stores when you sign in with Google, what other members can see, and how to change or delete your data.",
      },
      { property: "og:title", content: "Privacy Policy — Oka · One World Family" },
      {
        property: "og:description",
        content:
          "A plain-language account of what we collect, who can see it, and how to have it removed.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${DOMAIN}/privacy` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${DOMAIN}/privacy` }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      label="Privacy"
      title="Your privacy, plainly"
      intro="Oka exists so people can open their homes and their skills to each other. That only works if you can see exactly what we hold and who can see it. This is that explanation — no legalese."
      updated="19 October 2026"
      sections={SECTIONS}
      contact={
        <>
          <p className="section-label">Talk to us</p>
          <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
            Questions, a correction, or a request to see or delete your data — write to
            the person who runs Oka and you will get a real reply.
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
