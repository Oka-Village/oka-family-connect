/** Empty-state drawing. A real photo replaces it once one is uploaded. */
export function PresencePortrait() {
  return (
    <svg viewBox="0 0 140 140" className="size-full" aria-hidden="true">
      <circle cx="70" cy="70" r="70" fill="var(--sage-light)" />
      <circle cx="70" cy="58" r="22" fill="var(--terracotta-light)" />
      <path d="M28 124c6-28 24-42 42-42s36 14 42 42" fill="var(--terracotta)" />
      <path d="M52 46c4-16 32-18 40-2 6 4 8 2 10-6-8-14-42-16-52 0 2 4 1 6 2 8z" fill="var(--brown)" />
      <circle cx="96" cy="40" r="8" fill="var(--golden)" />
      <path d="M62 58 q 4 3 8 0 M78 58 q 4 3 8 0" fill="none" stroke="var(--brown)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
