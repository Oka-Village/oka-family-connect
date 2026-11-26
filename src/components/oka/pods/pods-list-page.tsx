import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Lock, Plus, Users } from "lucide-react";

import { EventsPodsSeg } from "@/components/oka/pods/events-pods-seg";
import { KaomojiPill } from "@/components/oka/pods/kaomoji-pill";
import { PodCard } from "@/components/oka/pods/pod-card";
import { PodsButton } from "@/components/oka/pods/pods-button";
import { PodsToastHost } from "@/components/oka/pods/pods-toast";
import { useRoles } from "@/hooks/use-is-admin";
import { canCreatePods } from "@/lib/pods/access";
import { POD_MEMBER_SEATS } from "@/lib/pods/constants";
import { listPublishedPods } from "@/lib/pods/pods.functions";
import { podIllustrationSrc } from "@/lib/pods/mock-data";
import fourWindows from "@/assets/pod-b-four-windows.svg.asset.json";
import { showPodsToast } from "@/lib/pods/toast";

const FACTS: { icon: typeof CalendarDays; title: string; body: ReactNode }[] = [
  {
    icon: CalendarDays,
    title: "One sign-up, three sessions",
    body: "When you sign up for a pod, you’re signing up in advance for all three encounters.",
  },
  {
    icon: Users,
    title: "The same people each time",
    body: (
      <>
        You meet the same facilitator and members. Seats are limited to{" "}
        <span className="pods-num">{POD_MEMBER_SEATS}</span> members per pod.
      </>
    ),
  },
  {
    icon: Lock,
    title: "What’s shared stays here",
    body: "No recordings. No judgment, criticism or advice.",
  },
];

export function PodsListPage() {
  const roles = useRoles();
  const showCreate = canCreatePods({
    isStaff: roles.data?.isStaff,
    isFacilitator: roles.data?.isFacilitator,
  });
  const query = useQuery({
    queryKey: ["pods-published"],
    queryFn: () => listPublishedPods(),
  });
  const pods = query.data?.pods ?? [];
  const firstOpenIdx = pods.findIndex((p) => p.paid_count < (p.capacity_members || POD_MEMBER_SEATS));

  return (
    <div className="pods-ui pb-16">
      <section className="pods-band-forest">
        <div className="pods-wrap grid items-center gap-12 py-12 max-[720px]:gap-6 max-[720px]:py-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-[720px]:order-2">
            <p className="pods-eyebrow text-[color:var(--pods-on-element-forest)]">Pods</p>
            <h1 className="mt-3 mb-4 font-serif text-[56px] font-medium leading-[58px] text-balance text-[color:var(--pods-on-element-forest)] max-[720px]:text-[40px] max-[720px]:leading-[44px]">
              Three encounters, one <i className="text-[color:var(--pods-element-forest-accent)]">small circle</i>
            </h1>
            <p className="max-w-[46ch] text-[17px] leading-[27px] text-[color:var(--pods-on-element-forest)]">
              You, two other members and a facilitator. The same people, all three times, with room to listen and be
              heard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PodsButton
                variant="sun"
                onClick={() => document.getElementById("open")?.scrollIntoView({ behavior: "smooth" })}
              >
                See open pods
              </PodsButton>
              {showCreate ? (
                <PodsButton variant="outline" href="/pods/new" className="!text-[color:var(--pods-on-element-forest)] !shadow-[inset_0_0_0_1.5px_currentColor]">
                  <Plus size={18} strokeWidth={1.8} aria-hidden />
                  Create a pod
                </PodsButton>
              ) : null}
            </div>
          </div>
          <figure className="relative h-[372px] overflow-hidden rounded-[var(--pods-radius-lg)] max-[720px]:order-1 max-[720px]:h-[200px]">
            <img
              src={fourWindows.url}
              alt="Four members, each at their own home window, joined in one circle around a candle"
              className="size-full object-cover"
            />
            <span className="absolute left-4 top-4">
              <KaomojiPill id="with-you" className="bg-[color:var(--pods-surface-card)] text-[color:var(--pods-ink)]" />
            </span>
            <figcaption className="absolute bottom-3 right-3 rounded-[var(--pods-radius-pill)] bg-[color:var(--pods-surface-earth)] px-2.5 py-1 text-xs leading-4 text-[color:var(--pods-ink-on-dark)]">
              Illustrative image
            </figcaption>
          </figure>
        </div>
      </section>

      <div className="pods-wrap flex flex-col gap-12 py-12 max-[720px]:gap-8 max-[720px]:py-6">
        <EventsPodsSeg current="pods" />

        <ul className="m-0 grid list-none grid-cols-3 gap-6 p-0 max-[720px]:grid-cols-1 max-[720px]:gap-4">
          {FACTS.map((f) => (
            <li
              key={f.title}
              className="flex items-start gap-4 rounded-[var(--pods-radius-md)] border border-[color:var(--pods-line-hairline)] bg-[color:var(--pods-surface-card)] p-6"
            >
              <f.icon className="mt-0.5 size-7 shrink-0 text-[color:var(--pods-element-fire)]" strokeWidth={1.8} aria-hidden />
              <div>
                <b className="mb-1 block text-[17px] font-semibold leading-6">{f.title}</b>
                <p className="m-0 text-sm leading-5 text-[color:var(--pods-ink-secondary)]">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <section id="open">
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <h2 className="m-0 font-serif text-[32px] font-medium leading-9">Find your circle</h2>
            <KaomojiPill id="welcome" tintClassName="pods-tint-forest" />
          </div>
          {query.isLoading ? (
            <p className="text-sm text-[color:var(--pods-ink-secondary)]">Loading pods…</p>
          ) : query.isError ? (
            <p className="text-sm text-[color:var(--pods-ink-fire)]" role="alert">
              Couldn’t load pods. Please try again.
            </p>
          ) : pods.length === 0 ? (
            <p className="text-sm text-[color:var(--pods-ink-secondary)]">
              No open pods yet.{showCreate ? " Create one to get started." : " Check back soon."}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {pods.map((pod, i) => (
                <PodCard
                  key={pod.id}
                  pod={pod}
                  featured={i === firstOpenIdx}
                  onWaitlist={() =>
                    showPodsToast("You’re on the waitlist. We’ll write if a seat opens.", "peaceful")
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-[240px_1fr] items-center gap-8 overflow-hidden rounded-[var(--pods-radius-lg)] bg-[color:var(--pods-tint-earth)] px-8 py-6 text-[color:var(--pods-ink-earth)] max-[720px]:grid-cols-1 max-[720px]:px-6">
          <img src={podIllustrationSrc("06-tea-for-two.svg")} alt="" className="w-full" />
          <div>
            <KaomojiPill id="peaceful" tintClassName="pods-tint-water" />
            <h2 className="mt-3 mb-2 font-serif text-[26px] font-medium leading-[30px]">Come as you are</h2>
            <p className="m-0 text-[15px] leading-6">
              Find a quiet place, open your computer or tablet, and bring a cup of something warm. Your facilitator
              holds the rest.
            </p>
          </div>
        </section>
      </div>

      <PodsToastHost />
    </div>
  );
}
