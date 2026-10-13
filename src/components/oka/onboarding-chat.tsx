import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Search } from "lucide-react";

import okaLogo from "@/assets/oka-logo.png";
import { pillOutline, pillPrimary } from "@/components/oka/postcard";
import {
  CLOSING, DEFERRED, SKIPPED, STEPS, TOTAL, activeSteps, formatAnswer,
  type Answers, type Step,
} from "@/lib/onboarding-chat";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "oka:onboarding-chat";
const DONE = "done";
type Saved = { answers: Answers; cursor: string };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const field = cn("w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground", focusRing);

/** Earliest of the current cursor and the first unanswered active step, given fresh answers. */
function settleCursor(answers: Answers, cursor: string) {
  const list = activeSteps(answers);
  const firstOpen = list.findIndex((s) => answers[s.id] === undefined);
  const cur = cursor === DONE ? list.length : list.findIndex((s) => s.id === cursor);
  const idx = Math.min(cur === -1 ? list.length : cur, firstOpen === -1 ? list.length : firstOpen);
  return list[idx]?.id ?? DONE;
}

export function OnboardingChat() {
  const [answers, setAnswers] = useState<Answers>({});
  const [cursor, setCursor] = useState<string>(STEPS[0]!.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => activeSteps(answers), [answers]);
  const curIdx = cursor === DONE ? list.length : Math.max(0, list.findIndex((s) => s.id === cursor));
  const hasAnswers = Object.keys(answers).length > 0;

  // Restore after mount so server and client markup match.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) { const s = JSON.parse(raw) as Saved; setAnswers(s.answers ?? {}); setCursor(s.cursor ?? STEPS[0]!.id); }
    } catch { /* ignore corrupt state */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, cursor } satisfies Saved));
  }, [answers, cursor, hydrated]);

  // Gentle typing dots before each new guide message.
  useEffect(() => {
    if (!hydrated || reducedMotion()) return;
    setTyping(true);
    const t = window.setTimeout(() => setTyping(false), 500);
    return () => window.clearTimeout(t);
  }, [cursor, hydrated]);

  useEffect(() => {
    if (editing) return;
    endRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "end" });
  }, [cursor, typing, editing]);

  function submit(step: Step, value: unknown) {
    const next = { ...answers, [step.id]: value };
    if (!activeSteps(next).some((s) => s.id === "hosting")) delete next["hosting"];
    setAnswers(next);
    if (editing) {
      setEditing(null);
      setCursor(settleCursor(next, cursor));
    } else {
      const l = activeSteps(next);
      const i = l.findIndex((s) => s.id === step.id);
      setCursor(l[i + 1]?.id ?? DONE);
    }
  }

  function back() {
    setEditing(null);
    if (curIdx > 0) setCursor(list[curIdx - 1]!.id);
  }

  function restart() {
    sessionStorage.removeItem(STORAGE_KEY);
    setAnswers({}); setEditing(null); setConfirming(false); setCursor(STEPS[0]!.id);
    window.scrollTo({ top: 0 });
  }

  const countedDone = cursor === DONE ? TOTAL : list.slice(0, curIdx + 1).filter((s) => s.counted).length || 1;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={back} disabled={curIdx === 0} aria-label="Back to previous question"
            className={cn("-ml-2 inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-secondary disabled:opacity-40", focusRing)}>
            <ArrowLeft className="size-5 text-primary" strokeWidth={1.5} />
          </button>
          <p className="text-[13px] text-muted-foreground" aria-live="polite">{countedDone} of {TOTAL}</p>
          <button type="button" onClick={() => (hasAnswers ? setConfirming(true) : restart())}
            className={cn("rounded-full px-3 py-2 text-sm text-primary hover:bg-secondary", focusRing)}>Restart</button>
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-sand" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={countedDone}>
          <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${(countedDone / TOTAL) * 100}%` }} />
        </div>
        {confirming && (
          <div role="alertdialog" aria-labelledby="restart-title" className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p id="restart-title" className="text-sm text-foreground">Clear your answers and begin again?</p>
            <div className="mt-3 flex gap-2">
              <button type="button" autoFocus className={pillPrimary} onClick={restart}>Restart</button>
              <button type="button" className={pillOutline} onClick={() => setConfirming(false)}>Keep going</button>
            </div>
          </div>
        )}
      </header>

      <div role="log" aria-live="polite" aria-label="Onboarding conversation" className="flex flex-1 flex-col gap-4 px-4 py-6">
        {hydrated && list.slice(0, Math.min(curIdx + 1, list.length)).map((step, i) => {
          const isCurrent = i === curIdx;
          if (isCurrent && typing) return <Guide key={step.id}><TypingDots /></Guide>;
          return (
            <div key={step.id} className="flex flex-col gap-3">
              <Guide>{step.prompt(answers)}</Guide>
              {isCurrent || editing === step.id ? (
                <StepInput key={`${step.id}-${editing ?? ""}`} step={step} initial={answers[step.id]} onSubmit={(v) => submit(step, v)}
                  onCancel={editing === step.id ? () => setEditing(null) : undefined} />
              ) : (
                <MemberBubble onEdit={() => setEditing(step.id)}>{formatAnswer(step, answers[step.id])}</MemberBubble>
              )}
            </div>
          );
        })}

        {hydrated && cursor === DONE && (typing ? <Guide><TypingDots /></Guide> : (
          <>
            <Guide>{CLOSING}</Guide>
            <div className="ml-10 text-[13px] text-muted-foreground">
              <p className="section-label">Asked later, when useful</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">{DEFERRED.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
            <Summary answers={answers} onEdit={(id) => setEditing(id)} onStartOver={restart} />
          </>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function Guide({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-end gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card" aria-hidden>
        <img src={okaLogo} alt="" className="h-2.5 w-auto" />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-card px-4 py-3 font-serif text-[21px] leading-snug text-foreground shadow-sm">
        <span className="sr-only">Oka: </span>{children}
      </div>
    </div>
  );
}

function MemberBubble({ children, onEdit }: { children: ReactNode; onEdit: () => void }) {
  return (
    <div className="flex justify-end">
      <button type="button" onClick={onEdit} aria-label={`Your answer: ${String(children)}. Edit`}
        className={cn("max-w-[85%] break-words rounded-2xl rounded-br-md bg-terracotta-tint px-4 py-2.5 text-left text-[15px] text-foreground hover:bg-terracotta-light/60", focusRing)}>
        {children}
      </button>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-2" aria-label="Oka is typing">
      {[0, 150, 300].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />)}
    </span>
  );
}

function Chip({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-40", focusRing,
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary")}>
      {selected && <Check className="size-3.5" strokeWidth={1.5} aria-hidden />}{children}
    </button>
  );
}

function StepInput({ step, initial, onSubmit, onCancel }: { step: Step; initial: unknown; onSubmit: (v: unknown) => void; onCancel?: (() => void) | undefined }) {
  const k = step.kind;
  const wrap = (body: ReactNode) => (
    <div className="ml-10 flex flex-col gap-3">
      {body}
      {onCancel && <button type="button" onClick={onCancel} className={cn("self-start text-sm text-muted-foreground underline-offset-4 hover:underline", focusRing)}>Cancel edit</button>}
    </div>
  );

  if (k.type === "name") return wrap(<NameInput initial={initial as { first: string; last: string } | undefined} onSubmit={onSubmit} />);
  if (k.type === "single") return wrap(
    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose one">
      {k.options.map((o) => <Chip key={o} selected={initial === o} onClick={() => onSubmit(o)}>{o}</Chip>)}
    </div>,
  );
  if (k.type === "multi") return wrap(<MultiInput options={k.options} max={k.max} searchable={k.searchable} initial={(initial as string[] | undefined) ?? []} onSubmit={onSubmit} />);
  return wrap(<TextInput step={step} initial={typeof initial === "string" && initial !== SKIPPED ? initial : ""} onSubmit={onSubmit} />);
}

function NameInput({ initial, onSubmit }: { initial?: { first: string; last: string } | undefined; onSubmit: (v: unknown) => void }) {
  const [first, setFirst] = useState(initial?.first ?? "");
  const [last, setLast] = useState(initial?.last ?? "");
  const ok = first.trim() && last.trim();
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit({ first: first.trim(), last: last.trim() }); }}>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">First name
          <input autoFocus required autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} maxLength={60} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">Last name
          <input required autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} maxLength={60} className={field} />
        </label>
      </div>
      <button type="submit" disabled={!ok} className={cn(pillPrimary, "self-start")}>Continue</button>
    </form>
  );
}

function TextInput({ step, initial, onSubmit }: { step: Step; initial: string; onSubmit: (v: unknown) => void }) {
  const k = step.kind;
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const id = `oc-${step.id}`;
  const optional = k.type === "textarea" || k.type === "url";

  function send() {
    const v = value.trim();
    if (k.type === "url" && v) {
      try {
        const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
        if (!u.hostname.includes(".")) throw new Error();
        return onSubmit(u.toString());
      } catch { return setError("That link doesn't look quite right."); }
    }
    if (!v) return optional ? onSubmit(SKIPPED) : undefined;
    onSubmit(v);
  }

  const label = k.type === "text" || k.type === "textarea" || k.type === "url" ? k.label : "";
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <label htmlFor={id} className="sr-only">{label}</label>
      {k.type === "textarea" ? (
        <>
          <textarea id={id} autoFocus value={value} maxLength={k.max} rows={3} onChange={(e) => setValue(e.target.value)} className={cn(field, "resize-none")} />
          <p className="text-right text-[11px] text-muted-foreground">{value.length} / {k.max}</p>
        </>
      ) : (
        <input id={id} autoFocus value={value} type={k.type === "url" ? "url" : "text"} inputMode={k.type === "url" ? "url" : undefined}
          placeholder={k.type === "text" ? k.placeholder : "instagram.com/you"} maxLength={200}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => { setValue(e.target.value); setError(null); }} className={field} />
      )}
      {error && <p id={`${id}-err`} role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!optional && !value.trim()} className={pillPrimary}>Continue</button>
        {optional && <button type="button" className={pillOutline} onClick={() => onSubmit(SKIPPED)}>Skip</button>}
      </div>
    </form>
  );
}

function MultiInput({ options, max, searchable, initial, onSubmit }: { options: readonly string[]; max?: number | undefined; searchable?: boolean | undefined; initial: string[]; onSubmit: (v: unknown) => void }) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const full = max !== undefined && picked.length >= max;
  const shown = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : full ? p : [...p, o]));
  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <div className="relative">
          <label htmlFor="oc-search" className="sr-only">Filter skills</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-primary" strokeWidth={1.5} aria-hidden />
          <input id="oc-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to filter" className={cn(field, "pl-10")} />
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose options">
        {shown.map((o) => <Chip key={o} selected={picked.includes(o)} disabled={full && !picked.includes(o)} onClick={() => toggle(o)}>{o}</Chip>)}
        {!shown.length && <p className="text-sm text-muted-foreground">Nothing matches that.</p>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={!picked.length} className={pillPrimary} onClick={() => onSubmit(picked)}>Continue</button>
        {max !== undefined && <p className="text-[13px] text-muted-foreground" aria-live="polite">{picked.length} of {max} chosen</p>}
      </div>
    </div>
  );
}

function Summary({ answers, onEdit, onStartOver }: { answers: Answers; onEdit: (id: string) => void; onStartOver: () => void }) {
  const [picking, setPicking] = useState(false);
  const list = activeSteps(answers);
  const LABELS: Record<string, string> = {
    name: "Name", age: "Age range", location: "Where", relationship: "Relationship", bio: "About you", link: "Online",
    seeking: "Seeking", season: "Season of life", looking: "Looking for", gift: "Gift economy", offer: "Offering", hosting: "Hosting", skills: "Skills",
  };
  return (
    <section aria-label="Your answers" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="section-label">Your answers</p>
      <dl className="mt-4 space-y-3">
        {list.map((s) => (
          <div key={s.id} className="border-b border-border pb-3 last:border-0">
            <dt className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">{LABELS[s.id]}</dt>
            <dd className="mt-1 flex items-start justify-between gap-3 break-words text-[15px] text-foreground">
              <span className="min-w-0">{formatAnswer(s, answers[s.id])}</span>
              {picking && <button type="button" onClick={() => onEdit(s.id)} className={cn("shrink-0 text-sm text-primary underline-offset-4 hover:underline", focusRing)}>Edit<span className="sr-only"> {LABELS[s.id]}</span></button>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={pillPrimary} onClick={onStartOver}>Start over</button>
        <button type="button" className={pillOutline} aria-pressed={picking} onClick={() => setPicking((p) => !p)}>{picking ? "Done editing" : "Edit an answer"}</button>
      </div>
    </section>
  );
}
