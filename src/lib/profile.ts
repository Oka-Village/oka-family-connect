/**
 * Shared profile helpers: the shape Oka reads from the profiles table and the
 * profile-completeness concept used across onboarding and the shell.
 */

export type OkaProfile = {
  id: string;
  display_name: string | null;
  photo_url: string | null;
  location: string | null;
  age_range: string | null;
  profession: string | null;
  relationship_status: string | null;
  intentions: string[] | null;
  gift_excited_to_give: string | null;
  gift_loved_gestures: string | null;
  skill_tags: string[] | null;
  travel_frequent: string[] | null;
  travel_desired: string[] | null;
  membership_tier: "free" | "full";
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
};

/** Fields that count toward the completeness score, in weight order. */
const COMPLETENESS_FIELDS: Array<keyof OkaProfile> = [
  "display_name",
  "photo_url",
  "location",
  "age_range",
  "profession",
  "skill_tags",
];

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

/** 0-100 score describing how filled-in a profile is. */
export function profileCompleteness(profile: Partial<OkaProfile> | null | undefined): number {
  if (!profile) return 0;
  const filled = COMPLETENESS_FIELDS.filter((field) => hasValue(profile[field])).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
