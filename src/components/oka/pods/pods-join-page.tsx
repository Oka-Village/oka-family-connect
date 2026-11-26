import { useId, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Calendar, Clock, CreditCard, Heart, Info, Leaf, Lock } from "lucide-react";

import { HeaderBand } from "@/components/oka/pods/header-band";
import { KaomojiPill } from "@/components/oka/pods/kaomoji-pill";
import { PodsButton } from "@/components/oka/pods/pods-button";
import { PodsToastHost } from "@/components/oka/pods/pods-toast";
import {
  POD_COMMITMENTS,
  POD_ENCOUNTER_COUNT,
  POD_PAY_COPY,
  type PodCommitment,
} from "@/lib/pods/constants";
import { POD_PRICE_CENTS } from "@/lib/pods/config";
import { startPodCheckout } from "@/lib/stripe/pod.functions";
import { showPodsToast } from "@/lib/pods/toast";
import { cn } from "@/lib/utils";
import type { getPod } from "@/lib/pods/pods.functions";

const ICONS: Record<PodCommitment["icon"], typeof Calendar> = {
  calendar: Calendar,
  card: CreditCard,
  heart: Heart,
  lock: Lock,
  leaf: Leaf,
};

const TINT: Record<PodCommitment["tint"], string> = {
  "t-sun": "pods-tint-sun",
  "t-water": "pods-tint-water",
  "t-fire": "pods-tint-fire",
  "t-earth": "pods-tint-earth",
  "t-linen": "pods-tint-linen",
};

type PodDetail = NonNullable<Awaited<ReturnType<typeof getPod>>>;

type Props = {
  detail: PodDetail;
};

export function PodsJoinPage({ detail }: Props) {
  const navigate = useNavigate();
  const pod = detail.pod!;
  const [step, setStep] = useState<1 | 2 | 3>(detail.enrollment?.status === "paid" ? 3 : 1);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(POD_COMMITMENTS.map((c) => [c.id, false])),
  );
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const formId = useId();

  const confirmedCount = POD_COMMITMENTS.filter((c) => checked[c.id]).length;
  const left = POD_COMMITMENTS.length - confirmedCount;

  function goStep(n: 1 | 2 | 3) {
    setStep(n);
    requestAnimationFrame(() => stepHeadingRef.current?.focus({ preventScroll: true }));
    window.scrollTo({ top: 0 });
  }

  function onContinue() {
    if (left > 0) {
      setAsk(true);
      return;
    }
    setAsk(false);
    goStep(2);
  }

  async function onPay() {
    setPayError(null);
    setBusy(true);
    try {
      const result = await startPodCheckout({
        data: {
          podId: pod.id,
          acceptedCommitmentIds: POD_COMMITMENTS.map((c) => c.id),
        },
      });
      if (result.status === "already_paid") {
        goStep(3);
        showPodsToast("Seat saved", "welcome");
        return;
      }
      window.location.assign(result.url);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Couldn't start payment.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const n = POD_COMMITMENTS.filter((c) => next[c.id]).length;
      if (n === POD_COMMITMENTS.length) setAsk(false);
      return next;
    });
  }

  const encounters = detail.encounters;

  return (
    <div className="pods-ui pb-16">
      <HeaderBand
        tone="forest"
        eyebrow="Join a pod"
        title={
          <>
            Take your <i>seat</i>
          </>
        }
      />

      <div className="pods-wrap grid items-start gap-8 py-12 max-[1100px]:grid-cols-1 lg:grid-cols-[340px_1fr]">
        <aside className="overflow-hidden rounded-[var(--pods-radius-lg)] border border-[color:var(--pods-line-hairline)] bg-[color:var(--pods-surface-card)]">
          <div className="flex flex-col gap-4 p-6">
            <div>
              <p className="pods-eyebrow">
                {detail.paidCount}/{pod.capacity_members} seats
              </p>
              <h2 className="mt-2 font-serif text-[26px] font-medium leading-[30px]">{pod.title}</h2>
            </div>
            <p className="pods-by m-0">Facilitated by {detail.host?.display_name ?? "Facilitator"}</p>
            <ul className="m-0 list-none p-0">
              {encounters.map((enc, i) => (
                <li
                  key={enc.id}
                  className="grid grid-cols-[48px_1fr] items-center gap-3 border-t border-[color:var(--pods-line-hairline)] py-2.5 text-sm leading-5"
                >
                  <span className="pods-num text-[28px] font-light leading-8">{i + 1}</span>
                  <span>
                    Encounter <span className="pods-num">{enc.session_index}</span>
                    <br />
                    <span className="text-xs text-[color:var(--pods-ink-muted)]">
                      {new Date(enc.starts_at).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: enc.timezone || undefined,
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="m-0 text-xs text-[color:var(--pods-ink-muted)]">
              <span className="pods-num">{POD_ENCOUNTER_COUNT}</span> encounters,{" "}
              <span className="pods-num">1</span> payment (${(POD_PRICE_CENTS / 100).toFixed(0)})
            </p>
          </div>
        </aside>

        <div className="rounded-[var(--pods-radius-lg)] border border-[color:var(--pods-line-hairline)] bg-[color:var(--pods-surface-card)] p-8 max-[720px]:p-4">
          <ol className="mb-8 flex list-none gap-3 p-0">
            {(["Commitments", "Payment", "Confirmed"] as const).map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3;
              return (
                <li
                  key={label}
                  className={cn(
                    "flex flex-1 items-center gap-2.5 border-b-[3px] border-[color:var(--pods-line-hairline)] pb-3 text-sm leading-5 text-[color:var(--pods-ink-muted)] max-[720px]:flex-col max-[720px]:items-start max-[720px]:gap-1.5 max-[720px]:text-[13px]",
                    step === n &&
                      "border-[color:var(--pods-action-primary)] font-semibold text-[color:var(--pods-ink)]",
                    step > n && "border-[color:var(--pods-action-primary)] text-[color:var(--pods-ink-forest)]",
                  )}
                  aria-current={step === n ? "step" : undefined}
                >
                  <span className="pods-num grid size-7 place-items-center rounded-full text-sm shadow-[inset_0_0_0_1px_currentColor]">
                    {n}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>

          {step === 1 ? (
            <div className="flex flex-col gap-6">
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="m-0 font-serif text-[32px] font-medium leading-9 text-balance outline-none"
              >
                Before you join, please confirm your commitment
              </h2>
              <div className={cn("flex flex-col gap-3", ask && "ask")}>
                {POD_COMMITMENTS.map((c) => {
                  const Icon = ICONS[c.icon];
                  const on = checked[c.id];
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "grid cursor-pointer grid-cols-[44px_1fr_28px] items-center gap-4 rounded-[var(--pods-radius-md)] border border-[color:var(--pods-line-hairline)] bg-[color:var(--pods-surface-card)] p-4 max-[720px]:grid-cols-[1fr_28px]",
                        on && "border-[color:var(--pods-tint-forest)] bg-[color:var(--pods-tint-forest)]",
                        ask && !on && "border-[color:var(--pods-element-fire)]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-11 place-items-center self-start rounded-full max-[720px]:hidden",
                          TINT[c.tint],
                        )}
                      >
                        <Icon size={20} strokeWidth={1.8} aria-hidden />
                      </span>
                      <span>
                        <b className="block text-base font-semibold leading-6">{c.title}</b>
                        <span className="text-sm leading-[21px] text-[color:var(--pods-ink-secondary)]">
                          {c.text}
                        </span>
                      </span>
                      <input
                        id={`${formId}-${c.id}`}
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(c.id)}
                        className="pods-check size-7 cursor-pointer appearance-none rounded-lg border-[1.5px] border-[color:var(--pods-line-control)] bg-[color:var(--pods-surface-card)] checked:border-[color:var(--pods-action-primary)] checked:bg-[color:var(--pods-action-primary)]"
                      />
                    </label>
                  );
                })}
              </div>
              {ask && left > 0 ? (
                <p
                  className="flex items-center gap-2.5 rounded-[var(--pods-radius-md)] bg-[color:var(--pods-tint-fire)] px-4 py-3 text-sm leading-5 text-[color:var(--pods-ink-fire)]"
                  role="alert"
                >
                  <Info size={20} strokeWidth={1.8} aria-hidden />
                  <span>
                    <span className="pods-num">{left}</span>{" "}
                    {left === 1 ? "commitment is" : "commitments are"} still open. Please confirm{" "}
                    {left === 1 ? "it" : "them"} to continue.
                  </span>
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm leading-5 text-[color:var(--pods-ink-secondary)]" aria-live="polite">
                  <span className="pods-num">{confirmedCount}</span> of{" "}
                  <span className="pods-num">{POD_COMMITMENTS.length}</span> confirmed
                </span>
                <PodsButton variant="primary" onClick={onContinue}>
                  Continue to payment
                </PodsButton>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-6">
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="m-0 font-serif text-[32px] font-medium leading-9 text-balance outline-none"
              >
                One payment for all three
              </h2>
              <div className="flex flex-col gap-4 rounded-[var(--pods-radius-md)] bg-[color:var(--pods-surface-linen)] p-6">
                <p className="m-0 flex items-start gap-3 text-[15px] leading-[22px]">
                  <Lock size={20} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden />
                  <span>You’ll pay on Stripe’s secure page. Then Stripe brings you back here.</span>
                </p>
                <p className="m-0 flex items-start gap-3 text-[15px] leading-[22px]">
                  <CreditCard size={20} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{POD_PAY_COPY}</span>
                </p>
                <p className="m-0 flex items-start gap-3 text-[15px] leading-[22px]">
                  <Clock size={20} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    Your seat is held for <span className="pods-num">15</span> minutes while you pay ($
                    {(POD_PRICE_CENTS / 100).toFixed(0)}).
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <PodsButton variant="primary" onClick={onPay} disabled={busy}>
                  {busy ? "Opening Stripe…" : "Pay with Stripe"}
                </PodsButton>
                <PodsButton variant="outline" onClick={() => goStep(1)}>
                  Go back
                </PodsButton>
              </div>
              {payError ? (
                <p className="m-0 text-sm text-[color:var(--pods-ink-fire)]" role="alert">
                  {payError}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-6">
              <div>
                <h2
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="m-0 font-serif text-[32px] font-medium leading-9 outline-none"
                >
                  Your seat is saved
                </h2>
                <p className="mt-2 text-sm leading-5 text-[color:var(--pods-ink-secondary)]">
                  Payment received. All <span className="pods-num">{POD_ENCOUNTER_COUNT}</span> encounters are on
                  your schedule. You’ll get email reminders before each one.
                </p>
                <span className="mt-3 inline-block">
                  <KaomojiPill id="welcome" tintClassName="pods-tint-forest" />
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <PodsButton
                  variant="primary"
                  onClick={() => void navigate({ to: "/pods/$podId", params: { podId: pod.id } })}
                >
                  Go to my pod
                </PodsButton>
                <PodsButton variant="outline" href="/pods">
                  Back to pods
                </PodsButton>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <PodsToastHost />
    </div>
  );
}
