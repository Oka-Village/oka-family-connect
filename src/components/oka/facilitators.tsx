import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Calculator, CalendarDays, Check, FileText, HandHeart, Landmark,
  ListChecks, PhoneCall, Receipt, Scale, Sparkles, UserRoundCheck, Users, Video, Wallet,
} from "lucide-react";

import heroImage from "@/assets/facilitators-hero.jpg";
import { pillOutline, pillPrimary } from "@/components/oka/postcard";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "oka:facilitators";
const STEPS = ["Join", "Your practice", "Payments", "Agreement"] as const;

type FormValues = Record<string, string | string[]>;
type Saved = { step: number; checks: boolean[]; form?: FormValues; paymentChecks?: boolean[] };

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
  const [paymentChecks, setPaymentChecks] = useState<boolean[]>([false, false]);
  const [form, setForm] = useState<FormValues>({});
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
        if (Array.isArray(s.paymentChecks)) setPaymentChecks([Boolean(s.paymentChecks[0]), Boolean(s.paymentChecks[1])]);
        if (s.form && typeof s.form === "object") setForm(s.form);
      }
    } catch { /* ignore corrupt state */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, checks, form, paymentChecks } satisfies Saved));
  }, [step, checks, form, paymentChecks, hydrated]);

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
        {step === 1 && (
          <StepPractice
            values={form}
            onChange={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
            onContinue={() => goTo(2)}
            onBack={() => goTo(0)}
          />
        )}
        {step === 2 && (
          <StepPayments
            checks={paymentChecks}
            onToggle={(i) => setPaymentChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
            onContinue={() => goTo(3)}
            onBack={() => goTo(1)}
          />
        )}
        {step > 2 && <ComingNext step={step} onBack={() => goTo(step - 1)} />}
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
          <a href="https://cal.com/liran-rosenfeld-bex504/30min" target="_blank" rel="noopener noreferrer"
            className={cn(pillOutline, "inline-flex items-center gap-2")}>
            <PhoneCall className="size-4 text-primary" strokeWidth={1.5} aria-hidden /> Book a call
          </a>
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

/* ---------------- Step 2: Your practice ---------------- */

const ROLE_OPTIONS = ["Facilitator", "Teacher", "Space holder", "Coach", "Expert", "Wisdom partner"] as const;

const COUNTRIES = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile", "Colombia", "Costa Rica",
  "Croatia", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Guatemala",
  "Hungary", "Iceland", "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Kenya", "Latvia",
  "Lithuania", "Mexico", "Morocco", "Netherlands", "New Zealand", "Norway", "Peru", "Poland", "Portugal",
  "Romania", "Singapore", "Slovakia", "Slovenia", "South Africa", "South Korea", "Spain", "Sweden",
  "Switzerland", "Thailand", "Turkey", "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
] as const;

const TIMEZONES = [
  "UTC-12:00 — Baker Island", "UTC-11:00 — Pago Pago", "UTC-10:00 — Honolulu", "UTC-09:00 — Anchorage",
  "UTC-08:00 — Los Angeles", "UTC-07:00 — Denver", "UTC-06:00 — Mexico City", "UTC-05:00 — New York",
  "UTC-04:00 — Santiago", "UTC-03:00 — São Paulo", "UTC-02:00 — South Georgia", "UTC-01:00 — Azores",
  "UTC+00:00 — London", "UTC+01:00 — Berlin", "UTC+02:00 — Jerusalem", "UTC+03:00 — Nairobi",
  "UTC+04:00 — Dubai", "UTC+05:00 — Karachi", "UTC+05:30 — Mumbai", "UTC+06:00 — Dhaka",
  "UTC+07:00 — Bangkok", "UTC+08:00 — Singapore", "UTC+09:00 — Tokyo", "UTC+10:00 — Sydney",
  "UTC+11:00 — Nouméa", "UTC+12:00 — Auckland",
] as const;

const PAYMENT_METHODS = [
  "Bank transfer",
  "Crypto (only if supported for your country and approved by the operator)",
] as const;

type FieldDef = {
  key: string;
  label: string;
  required: boolean;
  kind: "text" | "email" | "select" | "textarea" | "roles";
  helper: string;
  isPublic: boolean;
  options?: readonly string[];
};

const PRACTICE_FIELDS: FieldDef[] = [
  { key: "legalName", label: "Full legal name", required: true, kind: "text", isPublic: false, helper: "Use the name you will use on your invoice." },
  { key: "publicName", label: "Public facilitator name", required: true, kind: "text", isPublic: true, helper: "The name members will see on your profile and events." },
  { key: "email", label: "Email address", required: true, kind: "email", isPublic: false, helper: "We will use this for your application, event coordination, and payment notices." },
  { key: "country", label: "Country of residence", required: true, kind: "select", isPublic: false, options: COUNTRIES, helper: "Used to assess onboarding and payment requirements." },
  { key: "timezone", label: "Timezone", required: true, kind: "select", isPublic: false, options: TIMEZONES, helper: "Used to schedule your live sessions." },
  { key: "roles", label: "Professional role", required: true, kind: "roles", isPublic: true, helper: "Facilitator, teacher, space holder, coach, expert, wisdom partner, or describe your role. Multiple selections permitted." },
  { key: "expertise", label: "Areas of expertise", required: true, kind: "textarea", isPublic: true, helper: "What subjects or practices do you professionally facilitate?" },
  { key: "training", label: "Relevant training and qualifications", required: true, kind: "textarea", isPublic: false, helper: "Tell us where you trained, what you studied, and any relevant certifications or licences." },
  { key: "experience", label: "Relevant facilitation experience", required: true, kind: "textarea", isPublic: false, helper: "Describe your experience leading sessions, including online sessions." },
  { key: "links", label: "Supporting links or documents", required: false, kind: "text", isPublic: false, helper: "Share your website, professional profile, training evidence, or sample session. Avoid unnecessary personal information." },
  { key: "languages", label: "Session languages", required: true, kind: "text", isPublic: true, helper: "Which languages can you comfortably facilitate in?" },
  { key: "session", label: "Your proposed session", required: true, kind: "textarea", isPublic: true, helper: "What would you like to offer, who is it for, and what can participants reasonably expect?" },
  { key: "format", label: "Session format and duration", required: true, kind: "text", isPublic: true, helper: "Describe the format and approximate length." },
  { key: "themes", label: "Connection to community themes", required: false, kind: "text", isPublic: true, helper: "Which monthly theme or weekly focus would your session support?" },
  { key: "safety", label: "Participant requirements and safety", required: true, kind: "textarea", isPublic: false, helper: 'Describe prerequisites, suitability limits, adaptations, or reasons someone should not participate. Enter "None identified" if appropriate.' },
  { key: "availability", label: "Availability", required: true, kind: "text", isPublic: true, helper: "How often would you like to offer sessions, and at what times?" },
  { key: "invoicingName", label: "Invoicing name or business", required: true, kind: "text", isPublic: false, helper: "Who will issue your invoices?" },
  { key: "paymentMethod", label: "Preferred payment method", required: true, kind: "select", isPublic: false, options: PAYMENT_METHODS, helper: "Bank transfer, or crypto only if supported for your country and approved by the operator." },
  { key: "why", label: "Why One World Family", required: true, kind: "textarea", isPublic: false, helper: "What draws you to this community, and what would you like to contribute?" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
      isPublic ? "border-sage bg-sage-light text-sage-ink" : "border-sand bg-secondary text-muted-foreground",
    )}>
      {isPublic ? "Public profile" : "Private"}
    </span>
  );
}

const fieldInput =
  "mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-[invalid=true]:border-destructive";

function StepPractice({ values, onChange, onContinue, onBack }: {
  values: FormValues;
  onChange: (key: string, value: string | string[]) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [tried, setTried] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const str = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "");
  const roles = Array.isArray(values["roles"]) ? (values["roles"] as string[]) : [];

  function fieldError(f: FieldDef): string | null {
    if (!f.required) return null;
    if (f.kind === "roles") return roles.length > 0 ? null : "Please choose at least one role.";
    const v = str(f.key).trim();
    if (!v) return "This field is required.";
    if (f.kind === "email" && !EMAIL_RE.test(v)) return "Please enter a valid email address.";
    return null;
  }

  const errors = PRACTICE_FIELDS.map((f) => ({ key: f.key, error: fieldError(f) }));
  const firstErrorKey = errors.find((e) => e.error)?.key;

  function handleContinue() {
    if (firstErrorKey) {
      setTried(true);
      document.getElementById(`fac-field-${firstErrorKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onContinue();
  }

  function toggleRole(role: string) {
    onChange("roles", roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]);
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="section-label">Your practice</p>
        <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">Tell us about your practice</h1>
        <p className="text-lg font-medium text-foreground">Help us understand what you bring</p>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
          Tell us about your professional background and the experience you want to offer. Clear, practical answers
          help us review your application and support your first session.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {PRACTICE_FIELDS.map((f) => {
          const error = tried ? fieldError(f) : null;
          const describedBy = `fac-help-${f.key}${error ? ` fac-err-${f.key}` : ""}`;
          return (
            <div key={f.key} id={`fac-field-${f.key}`} className="surface-card scroll-mt-6 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={`fac-input-${f.key}`} className="font-semibold text-foreground">
                  {f.label}
                  {f.required ? <span className="text-primary" aria-hidden> *</span> : (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">(optional)</span>
                  )}
                </label>
                <VisibilityBadge isPublic={f.isPublic} />
              </div>

              {f.kind === "textarea" ? (
                <textarea
                  id={`fac-input-${f.key}`}
                  rows={4}
                  value={str(f.key)}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={error ? true : undefined}
                  className={cn(fieldInput, "resize-y leading-relaxed")}
                />
              ) : f.kind === "select" ? (
                <select
                  id={`fac-input-${f.key}`}
                  value={str(f.key)}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={error ? true : undefined}
                  className={fieldInput}
                >
                  <option value="">Choose…</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.kind === "roles" ? (
                <fieldset aria-describedby={describedBy} aria-invalid={error ? true : undefined} className="mt-3 border-0 p-0">
                  <legend className="sr-only">{f.label}</legend>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((role) => {
                      const on = roles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleRole(role)}
                          className={cn(
                            "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
                            focusRing,
                            on ? "border-primary bg-terracotta-tint text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/50",
                          )}
                        >
                          {on && <Check className="size-3.5 text-primary" strokeWidth={2} aria-hidden />}
                          {role}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    id={`fac-input-${f.key}`}
                    type="text"
                    value={str("rolesOther")}
                    onChange={(e) => onChange("rolesOther", e.target.value)}
                    placeholder="Or describe your role…"
                    aria-label="Describe your role (optional)"
                    className={cn(fieldInput, "mt-3")}
                  />
                </fieldset>
              ) : (
                <input
                  id={`fac-input-${f.key}`}
                  type={f.kind === "email" ? "email" : "text"}
                  value={str(f.key)}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={error ? true : undefined}
                  className={fieldInput}
                />
              )}

              <p id={`fac-help-${f.key}`} className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.helper}</p>
              {error && (
                <p id={`fac-err-${f.key}`} role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="rounded-2xl border border-border bg-secondary/60 p-4 text-sm leading-relaxed text-muted-foreground">
        We use your application information to review your suitability, verify professional and payment eligibility,
        communicate with you, and administer your participation. Application answers and private payment information
        are not automatically published. Your public profile will contain only the fields identified as public and
        approved for publication. Read our{" "}
        <a href="#" onClick={(e) => e.preventDefault()} aria-disabled="true"
          className="text-primary underline-offset-4 hover:underline">
          Privacy Notice
        </a>{" "}
        <DraftChip>privacy notice link</DraftChip>{" "}
        for processing, retention, service providers, your rights, and how to contact us.
      </p>

      {tried && firstErrorKey && (
        <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm leading-relaxed text-foreground">
          Please complete the highlighted fields before continuing.
        </p>
      )}
      {savedAt !== null && (
        <p role="status" className="rounded-2xl border border-sage bg-sage-light p-4 text-sm leading-relaxed text-sage-ink">
          Saved on this device. You can come back and finish later.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleContinue} className={cn(pillPrimary, "inline-flex items-center gap-2")}>
          Continue to payments and terms <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => { setSavedAt(Date.now()); }}
          className={cn(pillOutline, "inline-flex items-center gap-2")}
        >
          Save and finish later
        </button>
        <button type="button" onClick={onBack}
          className={cn("inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline", focusRing)}>
          <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden /> Back
        </button>
      </div>
    </div>
  );
}

/* ---------------- Step 3: Payments ---------------- */

const POOL_FORMULAS = [
  "Eligible subscription revenue = subscription receipts − refunds and chargebacks − payment-processing fees − transaction taxes",
  "Facilitator pool = 50% × max(0, eligible subscription revenue − eligible affiliate commissions)",
  "Your monthly allocation = monthly pool × your eligible contribution score ÷ total eligible facilitator scores",
  "Your quarterly allocation = the sum of your monthly allocations, with separately disclosed corrections and any legally required withholding",
] as const;

const CONTRIBUTION_SIGNALS = [
  "Verified delivery time for approved live sessions.",
  "Verified participant attendance and meaningful participation.",
  "Participant satisfaction, using the disclosed feedback methodology.",
  "Continued attendance at later sessions.",
  "Growth in verified attendance across comparable events.",
] as const;

const QUARTERS = [
  ["January through March", "March 31"],
  ["April through June", "June 30"],
  ["July through September", "September 30"],
  ["October through December", "December 31"],
] as const;

const PAYMENT_CONFIRMATIONS = [
  "I understand how the facilitator pool and my variable allocation are calculated, including the permitted deductions and the absence of guaranteed earnings.",
  "I have read the current Contribution Policy, including its scoring methodology and rules for changes, corrections, and statement queries.",
] as const;

function SectionCard({ icon: Icon, id, title, children }: {
  icon: typeof HandHeart; id: string; title: string; children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="surface-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-terracotta-tint">
          <Icon className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 id={id} className="font-serif text-2xl text-foreground">{title}</h2>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function StepPayments({ checks, onToggle, onContinue, onBack }: {
  checks: boolean[];
  onToggle: (i: number) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [tried, setTried] = useState(false);
  const allChecked = checks.every(Boolean);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="section-label">Payments</p>
        <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">Understand your contribution and payments</h1>
      </header>

      <SectionCard icon={HandHeart} id="fac-shared" title="A shared contribution model">
        <p>
          One World Family shares part of its eligible subscription revenue with the facilitators who contribute
          approved live sessions to the community. Your earnings depend on the available facilitator pool and your
          share of eligible contributions. This is a variable revenue-sharing arrangement, not a fixed hourly rate
          or guaranteed payment per event.
        </p>
      </SectionCard>

      <SectionCard icon={Calculator} id="fac-pool" title="How the facilitator pool is calculated">
        <p>
          Each month we take the subscription revenue actually received, remove refunds, chargebacks,
          payment-processing fees and transaction taxes, then deduct eligible affiliate commissions. Half of what
          remains becomes the facilitator pool. The operator's general overhead, salaries, rent and income taxes
          are not deducted.
        </p>
        <div className="rounded-2xl border border-border bg-secondary/60 p-4 sm:p-5">
          <ul className="flex flex-col gap-2.5">
            {POOL_FORMULAS.map((line) => (
              <li key={line} className="font-mono text-[13px] leading-relaxed text-foreground">{line}</li>
            ))}
          </ul>
        </div>
      </SectionCard>

      <SectionCard icon={Sparkles} id="fac-example" title="A simple example">
        <p>
          If a month has $10,000 in subscription receipts, $1,000 in permitted deductions, and $3,000 in eligible
          affiliate commissions, $6,000 remains. The facilitator pool is $3,000. A facilitator with 10% of the total
          eligible contribution score receives $300 before any legally required personal withholding.
        </p>
        <p className="rounded-2xl border border-border bg-secondary/60 p-4 text-sm">
          These figures illustrate the calculation; they are not an earnings forecast or a statement of the
          platform's reporting currency.
        </p>
      </SectionCard>

      <SectionCard icon={ListChecks} id="fac-contributions" title="How contributions are recognised">
        <p>
          The published Contribution Policy <DraftChip>contribution policy link</DraftChip> explains how we measure and weight:
        </p>
        <ul className="flex flex-col gap-2">
          {CONTRIBUTION_SIGNALS.map((s) => (
            <li key={s} className="flex items-start gap-2.5">
              <Check className="mt-1 size-4 shrink-0 text-sage-ink" strokeWidth={1.5} aria-hidden />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <p>
          A score is a measure for allocating the pool. It does not promise a fixed value per hour, attendee, or
          rating. If no eligible revenue remains, the pool can be zero.
        </p>
      </SectionCard>

      <SectionCard icon={Scale} id="fac-fair" title="Keeping the model fair">
        <p>
          Material changes to the Contribution Policy <DraftChip>contribution policy link</DraftChip> will be communicated at least 30 calendar days before
          taking effect and apply prospectively. We will not retrospectively reduce previously earned allocations
          merely by changing the algorithm. Corrections for genuine errors, refunds, chargebacks or verified abuse
          will be itemised and explained.
        </p>
      </SectionCard>

      <SectionCard icon={Receipt} id="fac-quarterly" title="Quarterly statements and invoices">
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60">
                <th scope="col" className="px-4 py-2.5 font-semibold text-foreground">Earnings period</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-foreground">Quarter end and reporting trigger</th>
              </tr>
            </thead>
            <tbody>
              {QUARTERS.map(([period, end]) => (
                <tr key={end} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-foreground">{period}</td>
                  <td className="px-4 py-2.5">{end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          After the quarter closes we will provide your statement and request a matching invoice. We will initiate
          payment within 30 calendar days after receiving and validating a correct invoice and all required payment
          information. Bank or network settlement time may be additional.
        </p>
        <p>
          Please raise statement questions within 30 calendar days of receipt. This review window does not remove
          rights that cannot legally be waived.
        </p>
      </SectionCard>

      <SectionCard icon={Wallet} id="fac-receiving" title="Receiving your payment">
        <p>
          Payments use the supported methods and currencies shown in your account. Crypto payments are available only
          where supported and approved. Never submit a wallet recovery phrase or private key. Any transfer or
          conversion charges borne by you will be disclosed before payment approval. You remain responsible for your
          tax affairs and invoice requirements.
        </p>
      </SectionCard>

      <SectionCard icon={Users} id="fac-affiliate" title="Affiliate participation is separate">
        <p>
          Facilitator earnings and referral commissions are different programmes. Applying to facilitate does not
          automatically enrol you as an affiliate.
        </p>
      </SectionCard>

      {/* Confirmations */}
      <section aria-labelledby="fac-pay-confirm">
        <h2 id="fac-pay-confirm" className="section-label">Before you continue</h2>
        <div className="mt-4 flex flex-col gap-3" role="group" aria-label="Required payment confirmations">
          {PAYMENT_CONFIRMATIONS.map((text, i) => (
            <label key={text}
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
              <span className="flex-1 text-[14px] leading-relaxed text-muted-foreground">
                {i === 1 ? (
                  <>
                    I have read the current Contribution Policy <DraftChip>contribution policy link</DraftChip>, including its scoring
                    methodology and rules for changes, corrections, and statement queries.
                  </>
                ) : text}
              </span>
            </label>
          ))}
        </div>
        {tried && !allChecked && (
          <p role="alert" className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm leading-relaxed text-foreground">
            Please complete each required confirmation to continue.
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => (allChecked ? onContinue() : setTried(true))}
            className={cn(pillPrimary, "inline-flex items-center gap-2")}
          >
            Review and accept your agreement <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
          <button type="button" onClick={onBack}
            className={cn("inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline", focusRing)}>
            <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden /> Back
          </button>
        </div>
      </section>
    </div>
  );
}
