type TrialStore = {
  startIfUnset: (timestamp: string) => Promise<string | null>;
  readStartedAt: () => Promise<string | null>;
};

/** Conditional write plus read-back preserves the first timestamp under races. */
export async function recordTrialOnce(store: TrialStore, now = new Date()): Promise<string> {
  const started = await store.startIfUnset(now.toISOString());
  if (started) return started;
  const existing = await store.readStartedAt();
  if (!existing) throw new Error("We couldn’t start your trial. Please try again.");
  return existing;
}