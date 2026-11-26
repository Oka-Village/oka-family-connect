import { Plus } from "lucide-react";

import { POD_MEMBER_SEATS } from "@/lib/pods/constants";
import { podAvatarSrc } from "@/lib/pods/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  facilitatorName: string;
  facilitatorAvatar: string;
  /** Avatar keys for seated members */
  members: string[];
  /** Highlight this member as “me” */
  me?: string;
  className?: string;
};

export function SeatCircle({ facilitatorName, facilitatorAvatar, members, me, className }: Props) {
  const taken = Math.min(members.length, POD_MEMBER_SEATS);
  const left = POD_MEMBER_SEATS - taken;
  const label = `${taken} of ${POD_MEMBER_SEATS} seats taken, facilitated by ${facilitatorName}`;

  return (
    <div className={cn("pods-circle", className)} role="img" aria-label={label}>
      <svg className="path" viewBox="0 0 132 132" aria-hidden="true">
        <circle cx="66" cy="66" r="66" />
      </svg>
      <div className="pods-seat pods-seat-s0 pods-seat-lead">
        <img src={podAvatarSrc(facilitatorAvatar)} alt="" />
      </div>
      {Array.from({ length: POD_MEMBER_SEATS }, (_, i) => {
        const key = members[i];
        if (key) {
          return (
            <div
              key={`m-${i}`}
              className={cn("pods-seat", `pods-seat-s${i + 1}`, key === me && "pods-seat-me")}
            >
              <img src={podAvatarSrc(key)} alt="" />
            </div>
          );
        }
        return (
          <div key={`o-${i}`} className={cn("pods-seat", `pods-seat-s${i + 1}`, "pods-seat-open")}>
            <Plus size={20} strokeWidth={1.8} aria-hidden />
          </div>
        );
      })}
      <span className="mid">
        <span className="pods-num">{left || POD_MEMBER_SEATS}</span>
        <small>
          {left ? (left === 1 ? "seat open" : "seats open") : `of ${POD_MEMBER_SEATS}, full`}
        </small>
      </span>
    </div>
  );
}
