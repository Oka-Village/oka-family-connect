import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, FileText, HandHeart, Landmark,
  ListChecks, PhoneCall, Receipt, Sparkles, UserRoundCheck, Video, Wallet,
} from "lucide-react";

import heroImage from "@/assets/facilitators-hero.jpg";
import { pillOutline, pillPrimary } from "@/components/oka/postcard";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "oka:facilitators";
const STEPS = ["Join", "Your practice", "Payments", "Agreement"] as const;

type FormValues = Record<string, string | string[]>;
type Saved = { step: number; checks: boolean[]; form?: FormValues };

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Visible marker for any placeholder token in the copy, e.g. [book-a-call link]. */
function DraftChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-golden bg-golden-tint px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-golden-ink">
      Draft · to be confirmed{children ? `: ${children}` : ""}
    </span>
  );
}

const HOW_IT_WORKS = [
  { icon: FileText, text: "Tell us about your experience and the sessions you want to offer." },
  { icon: ListChecks, text: "Review our professional standards and payment requirements." },
  { icon: HandHeart, text: "Read and accept the Facilitator Agreement and Contribution Policy." },
  { icon: UserRoundCheck, text: "Submit your application for review." },
  { icon: Sparkles, text: "Once approved, create your facilitator profile and propose your first event." },
] as const;

const CONFIRMATIONS = [
  {
    icon: BadgeCheck, label: "Professional competence",
    text: "I confirm that I have relevant professional training and experience for the sessions I propose to offer. I will provide accurate information about my qualifications and work within my competence and any applicable licensing requirements.",
  },
  {
    icon: Receipt, label: "Invoicing",
    text: "I can issue a valid invoice in my own legal name or through my business before payment is made to me.",
  },
  {
    icon: Wallet, label: "Payment method",
    text: "I have access to an eligible bank account or a supported crypto wallet through which I can receive payments, subject to the platform's verification requirements and available payment options.",
  },
  {
    icon: CalendarDays, label: "Quarterly payment cycle",
    text: "I understand that earnings are calculated for calendar quarters ending March 31, June 30, September 30, and December 31. I will be asked to invoice after my quarterly statement is available. Payment follows receipt and validation of my invoice, under the payment terms shown in the agreement.",
  },
  {
    icon: Landmark, label: "Fees and taxes",
    text: "I understand that eligible revenue is calculated after the disclosed deductions, and that legally required withholding may apply to my payment. I am responsible for my own tax reporting and taxes on my earnings, except amounts that the operator is legally required to withhold and remit.",
  },
] as const;

export function FacilitatorsPage() {
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState<boolean[]>(() => CONFIRMATIONS.map(() => false));
  const [triedContinue, setTriedContinue] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const beginRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Saved>;
        if (typeof s.step === "number") setStep(Math.max(0, Math.min(STEPS.length - 1, s.step)));
        if (Array.isArray(s.checks)) setChecks(CONFIRMATIONS.map((_, i) => Boolean(s.checks?.[i])));
      }
    } catch { /* ignore corrupt state */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, checks } satisfies Saved));
  }, [step, checks, hydrated]);

  const allChecked = checks.every(Boolean);

  function goTo(next: number) {
    setStep(next);
    setTriedContinue(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[860px] px-4 pb-24 pt-10 sm:px-6">

        {/* Step indicator */}
        <nav aria-label="Facilitator onboarding progress" className="mb-10">
          <ol className="flex items-center gap-1 sm:gap-2">
            {STEPS.map((label, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={label} className="flex min-w-0 flex-1 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => i <= step && goTo(i)}
                    disabled={i > step}
                    aria-current={current ? "step" : undefined}
                    className={cn("group flex flex-col gap-2 text-left", i > step && "cursor-not-allowed", focusRing)}
                  >
                    <span className={cn(
                      "h-[3px] w-full rounded-full transition-colors",
                      done || current ? "bg-primary" : "bg-sand",
                    )} />
                    <span className={cn(
                      "truncate text-[11px] uppercase tracking-[0.14em] sm:text-xs",
                      current ? "font-semibold text-foreground" : done ? "text-primary" : "text-muted-foreground",
                    )}>
                      {i + 1}. {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {step === 0 && (
          <StepJoin
            beginRef={beginRef}
            checks={checks}
            triedContinue={triedContinue}
            allChecked={allChecked}
            onToggle={(i) => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
            onContinue={() => (allChecked ? goTo(1) : setTriedContinue(true))}
          />
        )}
        {step > 0 && <ComingNext step={step} onBack={() => goTo(step - 1)} />}
      </div>
    </div>
  );
}

function StepJoin({ beginRef, checks, triedContinue, allChecked, onToggle, onContinue }: {
  beginRef: React.RefObject<HTMLDivElement | null>;
  checks: boolean[];
  triedContinue: boolean;
  allChecked: boolean;
  onToggle: (i: number) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-14">
      {/* Hero */}
      <header className="flex flex-col gap-6">
        <p className="section-label">Join as a facilitator</p>
        <h1 className="font-serif text-4xl leading-tight text-foreground sm:text-5xl">Share your gift with One World Family</h1>
        <p className="max-w-[62ch] text-base leading-relaxed text-muted-foreground">
          A meaningful session can help someone pause, learn, grow, and feel less alone. We welcome trained facilitators,
          teachers, space holders, wisdom partners, and experts who want to contribute professional online experiences to our community.
        </p>
        <img
          src={heroImage}
          alt="A facilitator guiding a small circle of people gathered outdoors among hills and trees"
          width={1536}
          height={1024}
          className="aspect-[3/2] w-full rounded-2xl border border-border object-cover shadow-soft"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={cn(pillPrimary, "inline-flex items-center gap-2")}
            onClick={() => beginRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Apply to facilitate <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
          <span className="inline-flex flex-wrap items-center gap-2">
            <a href="#" aria-disabled="true" onClick={(e) => e.preventDefault()}
              className={cn(pillOutline, "inline-flex items-center gap-2 opacity-80")}>
              <PhoneCall className="size-4 text-primary" strokeWidth={1.5} aria-hidden /> Book a call
            </a>
            <DraftChip>book-a-call link</DraftChip>
          </span>
          <a href="https://luma.com/okaoneworldfamily" target="_blank" rel="noopener noreferrer"
            className={cn("inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm text-primary underline-offset-4 hover:underline", focusRing)}>
            <Video className="size-4" strokeWidth={1.5} aria-hidden /> Join a webinar (3 times a week)
          </a>
        </div>
      </header>

      {/* What you can bring */}
      <section aria-labelledby="fac-bring" className="surface-card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-terracotta-tint">
            <Sparkles className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
          </span>
          <h2 id="fac-bring" className="font-serif text-2xl text-foreground">What you can bring</h2>
        </div>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">
          Offer an online workshop, class, guided practice, discussion, or learning experience within your training and
          professional competence. Sessions should help members grow, reflect, connect, or develop useful skills. Our monthly
          themes and weekly focuses give the community a shared direction — propose a session that connects with a theme or
          suggest another topic for review.
        </p>
      </section>

      {/* How it works */}
      <section aria-labelledby="fac-how">
        <h2 id="fac-how" className="section-label">How it works</h2>
        <ol className="mt-5 flex flex-col gap-3">
          {HOW_IT_WORKS.map(({ icon: Icon, text }, i) => (
            <li key={text} className="surface-card flex items-start gap-4 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-light">
                <Icon className="size-5 text-sage-ink" strokeWidth={1.5} aria-hidden />
              </span>
              <p className="pt-2 text-[15px] leading-relaxed text-foreground">
                <span className="mr-2 font-serif text-lg text-primary">{i + 1}.</span>{text}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-2xl border border-border bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground">
          Applying does not guarantee approval, a published event, attendance, or earnings. We review applications for
          relevant training, experience, community fit, and safe professional practice.
        </p>
      </section>

      {/* Before you begin */}
      <section aria-labelledby="fac-begin" ref={beginRef} className="scroll-mt-8">
        <h2 id="fac-begin" className="section-label">Before you begin</h2>
        <p className="mt-3 text-sm text-muted-foreground">All five confirmations are required.</p>
        <div className="mt-5 flex flex-col gap-3" role="group" aria-label="Required confirmations">
          {CONFIRMATIONS.map(({ icon: Icon, label, text }, i) => (
            <label key={label}
              className={cn(
                "surface-card flex cursor-pointer items-start gap-4 p-5 transition-colors",
                checks[i] && "border-primary/50 bg-terracotta-tint/40",
              )}>
              <input
                type="checkbox"
                checked={checks[i] ?? false}
                onChange={() => onToggle(i)}
                className="mt-1 size-5 shrink-0 accent-[var(--color-primary)]"
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  <Icon className="size-4 text-primary" strokeWidth={1.5} aria-hidden /> {label}
                </span>
                <span className="mt-1.5 block text-[14px] leading-relaxed text-muted-foreground">{text}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          These confirmations check your eligibility. You will review and accept the full agreement before submitting your application.
        </p>
        {triedContinue && !allChecked && (
          <p role="alert" className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm leading-relaxed text-foreground">
            Please complete each required confirmation to continue. If you cannot meet a requirement, contact us to discuss your situation.
          </p>
        )}
        <button type="button" onClick={onContinue} className={cn(pillPrimary, "mt-6 inline-flex items-center gap-2")}>
          Continue to your application <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </section>
    </div>
  );
}

function ComingNext({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <div className="surface-card flex flex-col items-start gap-4 p-8 sm:p-10">
      <p className="section-label">{STEPS[step]}</p>
      <h1 className="font-serif text-3xl text-foreground sm:text-4xl">Coming next</h1>
      <p className="max-w-[56ch] text-[15px] leading-relaxed text-muted-foreground">
        This step is being written. Your progress so far is saved on this device, and you can go back at any time.
      </p>
      <button type="button" onClick={onBack} className={cn(pillOutline, "inline-flex items-center gap-2")}>
        <ArrowLeft className="size-4 text-primary" strokeWidth={1.5} aria-hidden /> Back to {STEPS[step - 1]}
      </button>
    </div>
  );
}
