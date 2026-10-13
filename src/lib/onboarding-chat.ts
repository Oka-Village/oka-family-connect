/** Content for the replayable chat-style onboarding prototype. Nothing here is persisted to the backend. */

export type Answers = Record<string, unknown>;

export type StepKind =
  | { type: "name" }
  | { type: "single"; options: readonly string[] }
  | { type: "text"; placeholder: string; label: string }
  | { type: "textarea"; max: number; label: string; skippable: true }
  | { type: "url"; label: string }
  | { type: "multi"; options: readonly string[]; max?: number; searchable?: boolean };

export type Step = {
  id: string;
  stage: "You" | "Seeking" | "Giving";
  /** Counts toward "n of 12"; conditional follow-ups do not. */
  counted: boolean;
  prompt: (a: Answers) => string;
  kind: StepKind;
  when?: (a: Answers) => boolean;
};

export const SEEKING = [
  "EcoVillage Life", "Home Swapping", "Slow Travel", "Global Friendships", "Professional Collaboration",
  "Digital Detox", "Emotional Grounding", "Spiritual Growth", "Skill Sharing", "Workshops",
  "Wellness Events", "Deep Connection", "Shared Adventures", "Conscious Partnership",
] as const;

export const SKILLS = [
  "Yoga", "Mindfulness", "Public Speaking", "Marketing", "Design", "Fitness", "Singing", "Music",
  "Software Development", "Business Advice", "Finance", "Cooking", "Gardening", "Permaculture",
  "Sustainability", "Climate Action", "Wellness", "Medicine", "Functional Medicine", "Comedy",
] as const;

const HOME = "Access to my home";

export const STEPS: Step[] = [
  { id: "name", stage: "You", counted: true, kind: { type: "name" },
    prompt: () => "Welcome. I'm glad you're here. I'll ask a few things, one at a time. It takes about two minutes. What should we call you?" },
  { id: "age", stage: "You", counted: true, kind: { type: "single", options: ["18-24", "25-34", "35-44", "45-54", "55+"] },
    prompt: (a) => `Nice to meet you, ${(a["name"] as { first?: string } | undefined)?.first ?? "friend"}. Which age range fits you?` },
  { id: "location", stage: "You", counted: true, kind: { type: "text", placeholder: "City, country", label: "Where you are right now" },
    prompt: () => "Where in the world are you right now?" },
  { id: "relationship", stage: "You", counted: true,
    kind: { type: "single", options: ["Single", "Conscious partnership", "Married", "Open relationship", "It's complicated", "Prefer not to say"] },
    prompt: () => "How would you describe your relationship status?" },
  { id: "bio", stage: "You", counted: true, kind: { type: "textarea", max: 280, label: "A sentence or two about you", skippable: true },
    prompt: () => "In a sentence or two, who are you?" },
  { id: "link", stage: "You", counted: true, kind: { type: "url", label: "Instagram or LinkedIn link" },
    prompt: () => "Where can people find you online? One link is plenty." },
  { id: "seeking", stage: "Seeking", counted: true, kind: { type: "multi", options: SEEKING, max: 5 },
    prompt: () => "What are you seeking right now? Choose up to five." },
  { id: "season", stage: "Seeking", counted: true,
    kind: { type: "single", options: ["Building", "Transitioning", "Relocating", "Resting", "Parenting", "Healing", "Pioneering"] },
    prompt: () => "What season of life are you in?" },
  { id: "looking", stage: "Seeking", counted: true, kind: { type: "single", options: [...SEEKING, "Just exploring"] },
    prompt: () => "And right now, what are you actively looking for?" },
  { id: "gift", stage: "Giving", counted: true, kind: { type: "single", options: ["Yes, I'm in", "I'm still learning"] },
    prompt: () => "Oka runs on a gift economy. How does that feel to you?" },
  { id: "offer", stage: "Giving", counted: true,
    kind: { type: "multi", options: ["Professional hours", HOME, "A vehicle", "Physical gifts", "Experiences", "A talent"] },
    prompt: () => "What would you like to offer the community? Tick any." },
  { id: "hosting", stage: "Giving", counted: false, kind: { type: "single", options: ["Private room", "Whole house", "Either"] },
    when: (a) => Array.isArray(a["offer"]) && (a["offer"] as string[]).includes(HOME),
    prompt: () => "Would you host guests in a private room, or the whole house?" },
  { id: "skills", stage: "Giving", counted: true, kind: { type: "multi", options: SKILLS, max: 5, searchable: true },
    prompt: () => "Which skills could you share? Pick up to five." },
];

export const TOTAL = STEPS.filter((s) => s.counted).length;

export const CLOSING = "That's enough to begin. Everything else, like your photo, travel places and the Pod Method, we'll ask only when it's useful.";

export const DEFERRED = [
  "Photo", "Household", "Hosting gestures (only for hosts)", "First step and what honors you",
  "Travel places", "Pod readiness", "WhatsApp sharing consent",
];

export const SKIPPED = "Skipped";

export function formatAnswer(step: Step, value: unknown): string {
  if (value === SKIPPED || value === "" || value == null) return SKIPPED;
  if (step.kind.type === "name") { const v = value as { first: string; last: string }; return `${v.first} ${v.last}`; }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function activeSteps(a: Answers) {
  return STEPS.filter((s) => !s.when || s.when(a));
}
