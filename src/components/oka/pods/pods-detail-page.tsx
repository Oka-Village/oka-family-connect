import { useQuery } from "@tanstack/react-query";

import { EncounterTrio } from "@/components/oka/pods/encounter-trio";
import { HeaderBand } from "@/components/oka/pods/header-band";
import { PodsButton } from "@/components/oka/pods/pods-button";
import { SeatCircle } from "@/components/oka/pods/seat-circle";
import { getPod } from "@/lib/pods/pods.functions";
import { POD_MEMBER_SEATS } from "@/lib/pods/constants";
import { useCurrentUserId } from "@/hooks/use-is-admin";

type Props = { podId: string };

export function PodsDetailPage({ podId }: Props) {
  const uid = useCurrentUserId();
  const query = useQuery({
    queryKey: ["pod", podId],
    queryFn: () => getPod({ data: { podId } }),
  });

  if (query.isLoading) {
    return <div className="pods-ui p-8 text-sm text-[color:var(--pods-ink-secondary)]">Loading…</div>;
  }
  if (query.isError || !query.data?.pod) {
    return (
      <div className="pods-ui p-8">
        <p className="text-sm text-[color:var(--pods-ink-fire)]" role="alert">
          Pod not found.
        </p>
        <PodsButton variant="outline" href="/pods" className="mt-4">
          Back to pods
        </PodsButton>
      </div>
    );
  }

  const { pod, encounters, paidCount, enrollment, host } = query.data;
  const isHost = uid.data === pod.host_id;
  const isMember = enrollment?.status === "paid";
  const next = encounters[0];

  return (
    <div className="pods-ui pb-16">
      <HeaderBand
        tone="fire"
        eyebrow={isMember ? `My pod · ${pod.title}` : pod.title}
        title={
          next ? (
            <>
              See you <i>{new Date(next.starts_at).toLocaleDateString(undefined, { weekday: "long" })}</i>
            </>
          ) : (
            pod.title
          )
        }
      />
      <div className="pods-wrap grid items-start gap-8 py-12 max-[1100px]:grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          {next ? (
            <div className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--pods-radius-lg)] border border-[color:var(--pods-line-hairline)] bg-[color:var(--pods-surface-card)] p-6">
              <div>
                <p className="pods-eyebrow">
                  Next · Encounter <span className="pods-num">{next.session_index}</span>
                </p>
                <p className="pods-num my-2 text-[40px] font-extralight leading-[44px] tracking-wide">
                  {new Date(next.starts_at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: next.timezone || undefined,
                  })}
                </p>
                <p className="text-sm text-[color:var(--pods-ink-secondary)]">
                  {new Date(next.starts_at).toLocaleString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    timeZone: next.timezone || undefined,
                  })}
                  {pod.meet_url && (isMember || isHost) ? " · Google Meet" : null}
                </p>
              </div>
              {pod.meet_url && (isMember || isHost) ? (
                <PodsButton variant="primary" href={pod.meet_url}>
                  Join the circle
                </PodsButton>
              ) : (
                <PodsButton variant="outline" disabled>
                  Room opens at encounter time
                </PodsButton>
              )}
            </div>
          ) : null}

          <EncounterTrio
            encounters={encounters.map((e) => {
              const d = new Date(e.starts_at);
              const tz = e.timezone || "UTC";
              return {
                weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(d),
                month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: tz }).format(d),
                day: Number(new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz }).format(d)),
              };
            })}
            mix
          />

          <div className="rounded-[var(--pods-radius-lg)] bg-[color:var(--pods-tint-earth)] p-6 text-[color:var(--pods-ink-earth)]">
            <h2 className="mt-0 font-serif text-[26px] font-medium leading-[30px]">Before you arrive</h2>
            <p className="m-0 text-sm leading-5">
              A quiet place. A computer or tablet, not a phone. No recording. And all of your attention, for the others
              and for you.
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-6 rounded-[var(--pods-radius-lg)] border border-[color:var(--pods-line-hairline)] bg-[color:var(--pods-surface-card)] p-6">
          <div className="flex justify-center">
            <SeatCircle
              facilitatorName={host?.display_name ?? "Facilitator"}
              facilitatorAvatar="ana"
              members={Array.from({ length: Math.min(paidCount, POD_MEMBER_SEATS) }, () => "amara")}
            />
          </div>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            <li className="flex items-center gap-3">
              <div>
                <b className="block text-base font-semibold">{host?.display_name ?? "Facilitator"}</b>
                <span className="text-sm text-[color:var(--pods-ink-secondary)]">Facilitator</span>
              </div>
            </li>
            <li className="text-sm text-[color:var(--pods-ink-secondary)]">
              {paidCount} of {pod.capacity_members} members enrolled
              {isMember ? " · You are in this circle" : null}
            </li>
          </ul>
          {!isMember && pod.status === "published" && paidCount < pod.capacity_members ? (
            <PodsButton variant="primary" href={`/pods/${pod.id}/join`}>
              Join this pod — $175
            </PodsButton>
          ) : null}
          <PodsButton variant="ghost" href="/pods">
            Back to pods
          </PodsButton>
        </aside>
      </div>
    </div>
  );
}
