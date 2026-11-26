export type KaomojiId = "welcome" | "with-you" | "peaceful";

export type KaomojiEntry = {
  id: KaomojiId;
  face: string;
  name: string;
};

/** Kaomoji registry — faces are aria-hidden; names carry meaning. Never next to Paid or in admin. */
export const POD_KAOMOJI: Record<KaomojiId, KaomojiEntry> = {
  welcome: { id: "welcome", face: "╰(´︶`)╯♡", name: "Welcome home" },
  "with-you": { id: "with-you", face: "⊂(´︶`)⊃", name: "With you" },
  peaceful: { id: "peaceful", face: "(˘ー˘)｡", name: "Peaceful" },
};

export function getKaomoji(id: KaomojiId): KaomojiEntry {
  return POD_KAOMOJI[id];
}
