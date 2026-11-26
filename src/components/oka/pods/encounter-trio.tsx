import type { PodEncounter } from "@/lib/pods/mock-data";
import { POD_ENCOUNTER_TIME } from "@/lib/pods/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  encounters: readonly PodEncounter[];
  /** Sun / forest / water tints — only the first open pod card */
  mix?: boolean;
  time?: string;
  className?: string;
};

export function EncounterTrio({
  encounters,
  mix = false,
  time = POD_ENCOUNTER_TIME,
  className,
}: Props) {
  return (
    <ol className={cn("pods-enc", mix && "pods-enc-mix", className)}>
      {encounters.map((enc, i) => (
        <li key={`${enc.month}-${enc.day}-${i}`}>
          <p className="lab">
            Encounter <span className="pods-num">{i + 1}</span>
          </p>
          <p className="date">
            <span className="day">{enc.day}</span>
            <span className="mon">{enc.month}</span>
          </p>
          <p className="time">
            {enc.weekday} · <span className="pods-num">{time}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
