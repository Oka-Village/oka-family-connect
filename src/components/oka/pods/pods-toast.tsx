import { useEffect, useState } from "react";

import { getKaomoji, type KaomojiId } from "@/lib/pods/kaomoji";
import { registerPodsToast } from "@/lib/pods/toast";

type ToastState = { text: string; faceId?: KaomojiId } | null;

export function PodsToastHost() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    registerPodsToast((text, faceId) => {
      setToast(faceId ? { text, faceId } : { text });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 2600);
    });
    return () => {
      registerPodsToast(null);
      clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;
  const face = toast.faceId ? getKaomoji(toast.faceId).face : null;

  return (
    <div className="pods-toast" role="status">
      {face ? (
        <span className="face" aria-hidden="true">
          {face}
        </span>
      ) : null}
      <span>{toast.text}</span>
    </div>
  );
}
