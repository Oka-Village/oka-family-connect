import { POD_ENCOUNTER_COUNT, POD_MEMBER_SEATS } from "@/lib/pods/constants";

export type PodEncounter = {
  weekday: string;
  month: string;
  day: number;
};

export type PodFacilitator = {
  name: string;
  avatar: string;
};

export type MockPod = {
  id: string;
  name: string;
  label: string;
  image: string;
  /** Avatar keys for seated members (length ≤ POD_MEMBER_SEATS). */
  members: string[];
  encounters: PodEncounter[];
};

export const POD_FACILITATOR: PodFacilitator = {
  name: "Michelin",
  avatar: "ana",
};

export const POD_ENCOUNTER_TIME = "11:00 AM PST";

export const MOCK_PODS: readonly MockPod[] = [
  {
    id: "dec-a",
    name: "One World Family Pod",
    label: "December A",
    image: "forest-creek",
    members: ["kofi", "mei"],
    encounters: [
      { weekday: "Thu", month: "Dec", day: 10 },
      { weekday: "Fri", month: "Dec", day: 11 },
      { weekday: "Sat", month: "Dec", day: 12 },
    ],
  },
  {
    id: "dec-b",
    name: "One World Family Pod",
    label: "December B",
    image: "mountain-forest",
    members: [],
    encounters: [
      { weekday: "Thu", month: "Dec", day: 17 },
      { weekday: "Fri", month: "Dec", day: 18 },
      { weekday: "Sat", month: "Dec", day: 19 },
    ],
  },
  {
    id: "jan-a",
    name: "One World Family Pod",
    label: "January A",
    image: "waterfall",
    members: ["sofia", "ravi", "lucas"],
    encounters: [
      { weekday: "Thu", month: "Jan", day: 7 },
      { weekday: "Fri", month: "Jan", day: 8 },
      { weekday: "Sat", month: "Jan", day: 9 },
    ],
  },
];

export function podImageSrc(key: string): string {
  return `/pods/images/${key}.jpg`;
}

export function podAvatarSrc(key: string): string {
  return `/pods/avatars/${key}.svg`;
}

export function podIllustrationSrc(file: string): string {
  return `/pods/illustrations/${file}`;
}

export function getMockPod(id: string): MockPod | undefined {
  return MOCK_PODS.find((p) => p.id === id);
}

export function isPodFull(pod: MockPod): boolean {
  return pod.members.length >= POD_MEMBER_SEATS;
}

export function openSeatCount(pod: MockPod): number {
  return Math.max(0, POD_MEMBER_SEATS - pod.members.length);
}

/** First open pod in the list gets sage primary + mixed encounter tints. */
export function isFeaturedOpenPod(pod: MockPod, index: number): boolean {
  if (isPodFull(pod)) return false;
  const firstOpen = MOCK_PODS.findIndex((p) => !isPodFull(p));
  return firstOpen === index;
}

export function assertEncounterCount(pod: MockPod): boolean {
  return pod.encounters.length === POD_ENCOUNTER_COUNT;
}
