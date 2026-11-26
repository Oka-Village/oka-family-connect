/** Member seats per pod (plus one facilitator). Change only here. */
export const POD_MEMBER_SEATS = 3;

export const POD_ENCOUNTER_COUNT = 3;

export type CommitmentTint = "t-sun" | "t-water" | "t-fire" | "t-earth" | "t-linen";

export type PodCommitment = {
  id: string;
  icon: "calendar" | "card" | "heart" | "lock" | "leaf";
  tint: CommitmentTint;
  title: string;
  text: string;
};

/** Five commitment texts — word for word from the Pods handoff mock. */
export const POD_COMMITMENTS: readonly PodCommitment[] = [
  {
    id: "all-three",
    icon: "calendar",
    tint: "t-sun",
    title: "All three sessions",
    text: "I understand that I must complete all three sessions and commit to them in advance.",
  },
  {
    id: "if-i-cant",
    icon: "card",
    tint: "t-water",
    title: "If I can’t come",
    text: "I understand that if I don’t show up, my payment is not refunded, unless One World Family can find a replacement for all three sessions.",
  },
  {
    id: "safe-space",
    icon: "heart",
    tint: "t-fire",
    title: "A safe space",
    text: "I commit to a safe space where power dynamics, judgment, resentment, criticism and advice are not allowed.",
  },
  {
    id: "full-privacy",
    icon: "lock",
    tint: "t-earth",
    title: "Full privacy",
    text: "I commit to full privacy: I will not record the sessions, and I will join from a quiet place on a computer or tablet, not a phone.",
  },
  {
    id: "fully-present",
    icon: "leaf",
    tint: "t-linen",
    title: "Fully present",
    text: "I commit to being 100% present and prioritizing the pod, knowing that if I don’t, I affect the other two participants and the facilitator.",
  },
];

export const POD_PAY_COPY =
  "One payment covers all 3 encounters. You'll see the amount before you pay.";
