/**
 * Shared profile helpers: the shape Oka reads from the profiles table and the
 * profile-completeness concept used across onboarding, My Profile and the shell.
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
  member_status: "full" | "limited";
  /** Set by the database when every completeness field is filled; awards +3 once. */
  profile_completed: boolean;
  /** Welcome steps finished or skipped. */
  onboarded_at: string | null;
  /** First trial start only; never used by access gates. */
  trial_started_at?: string | null;
  created_at: string;
  updated_at: string;
};

/** Every field that counts toward completeness — one per profile section item. */
export const COMPLETENESS_FIELDS = [
  "display_name",
  "photo_url",
  "age_range",
  "location",
  "relationship_status",
  "profession",
  "intentions",
  "gift_excited_to_give",
  "gift_loved_gestures",
  "skill_tags",
  "travel_frequent",
  "travel_desired",
] as const satisfies ReadonlyArray<keyof OkaProfile>;

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

/** Stable DOM ids for profile-edit sections — keep in sync with ProfileEditor Blocks. */
export const PROFILE_EDIT_SECTIONS = [
  "profile-edit-basic",
  "profile-edit-intentions",
  "profile-edit-gifts",
  "profile-edit-skills",
  "profile-edit-travel",
] as const;

export type ProfileEditSectionId = (typeof PROFILE_EDIT_SECTIONS)[number];

/** Maps each completeness field to the edit section that contains it. */
export const FIELD_TO_EDIT_SECTION = {
  display_name: "profile-edit-basic",
  photo_url: "profile-edit-basic",
  age_range: "profile-edit-basic",
  location: "profile-edit-basic",
  relationship_status: "profile-edit-basic",
  profession: "profile-edit-basic",
  intentions: "profile-edit-intentions",
  gift_excited_to_give: "profile-edit-gifts",
  gift_loved_gestures: "profile-edit-gifts",
  skill_tags: "profile-edit-skills",
  travel_frequent: "profile-edit-travel",
  travel_desired: "profile-edit-travel",
} as const satisfies Record<(typeof COMPLETENESS_FIELDS)[number], ProfileEditSectionId>;

/** 0-100 score describing how filled-in a profile is. */
export function profileCompleteness(profile: Partial<OkaProfile> | null | undefined): number {
  if (!profile) return 0;
  const filled = COMPLETENESS_FIELDS.filter((field) => hasValue(profile[field])).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

/** First edit section that still has at least one empty completeness field, or null when whole. */
export function nextIncompleteSection(profile: Partial<OkaProfile> | null | undefined): ProfileEditSectionId | null {
  if (!profile) return PROFILE_EDIT_SECTIONS[0];
  for (const field of COMPLETENESS_FIELDS) {
    if (!hasValue(profile[field])) return FIELD_TO_EDIT_SECTION[field];
  }
  return null;
}

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;

export const RELATIONSHIP_STATUSES = [
  "Single",
  "In a relationship",
  "Married",
  "It's complicated",
  "Prefer not to say",
] as const;

export const INTENTIONS = [
  "Global Friendships",
  "Slow Travel",
  "Skill Sharing",
  "Hosting",
  "Deep Connection",
  "Co-living",
] as const;
