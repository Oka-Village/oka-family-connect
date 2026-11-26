import { Video } from "lucide-react";

import { PodsButton } from "@/components/oka/pods/pods-button";
import { SeatCircle } from "@/components/oka/pods/seat-circle";
import { EncounterTrio } from "@/components/oka/pods/encounter-trio";
import { POD_ENCOUNTER_COUNT, POD_MEMBER_SEATS } from "@/lib/pods/constants";
import { podAvatarSrc, podImageSrc } from "@/lib/pods/mock-data";
import type { PodListItem } from "@/lib/pods/types";
import { cn } from "@/lib/utils";

type Props = {
  pod: PodListItem;
  featured?: boolean;
  onWaitlist?: () => void;
  className?: string;
};

export function PodCard({ pod, featured = false, onWaitlist, className }: Props) {
  const full = pod.paid_count >= (pod.capacity_members || POD_MEMBER_SEATS);
  const memberSlots = Array.from({ length: Math.min(pod.paid_count, POD_MEMBER_SEATS) }, (_, i) => `seat-${i}`);
  const photo = pod.photo_url || "forest-creek";
  const photoSrc = photo.startsWith("http") || photo.startsWith("/") ? photo : podImageSrc(photo);
  const hostAvatar = pod.host_avatar?.startsWith("http") || pod.host_avatar?.startsWith("/")
    ? pod.host_avatar
    : podAvatarSrc(pod.host_avatar || "ana");

  return (
    <article className={cn("pods-card", className)}>
      <figure className="pods-card-photo">
        <img src={photoSrc} alt="" />
      </figure>
      <div className="pods-card-in">
        <div className="pods-card-top">
          <div>
            <p className="pods-eyebrow">
              {pod.paid_count}/{pod.capacity_members} seats
            </p>
            <h3>{pod.title}</h3>
            <p className="pods-by">
              <img src={hostAvatar} alt="" />
              Facilitated by {pod.host_name ?? "Facilitator"}
            </p>
            <p className="pods-meta">
              <Video size={20} strokeWidth={1.8} aria-hidden />
              Virtual · Google Meet
            </p>
          </div>
          <SeatCircle
            facilitatorName={pod.host_name ?? "Facilitator"}
            facilitatorAvatar={pod.host_avatar?.includes("/") ? "ana" : pod.host_avatar || "ana"}
            members={memberSlots.map(() => "amara")}
          />
        </div>
        <EncounterTrio
          encounters={pod.encounters.map((e) => ({
            weekday: e.weekday,
            month: e.month,
            day: e.day,
          }))}
          mix={featured}
        />
        <div className="pods-card-foot">
          <span className="text-sm leading-5 text-[color:var(--pods-ink-secondary)]">
            {full ? (
              "This circle is complete."
            ) : (
              <>
                One sign-up covers all <span className="pods-num">{POD_ENCOUNTER_COUNT}</span> encounters.
              </>
            )}
          </span>
          {full ? (
            <PodsButton variant="outline" onClick={onWaitlist}>
              Join the waitlist
            </PodsButton>
          ) : (
            <PodsButton
              variant={featured ? "primary" : "outline"}
              href={`/pods/${pod.id}/join`}
              aria-label={`Join this pod, ${pod.title}`}
            >
              Join this pod — $175
            </PodsButton>
          )}
        </div>
      </div>
    </article>
  );
}
