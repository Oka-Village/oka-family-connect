import type { KaomojiId } from "@/lib/pods/kaomoji";

type Push = (text: string, faceId?: KaomojiId) => void;

let pushToast: Push | null = null;

export function registerPodsToast(push: Push | null) {
  pushToast = push;
}

export function showPodsToast(text: string, faceId?: KaomojiId) {
  pushToast?.(text, faceId);
}
