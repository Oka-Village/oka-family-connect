/** Bound only session verification, not profile reads or Google sign-in. */
export const SESSION_RESTORE_TIMEOUT_MS = 15_000;

/** Only a server-confirmed invalid session may clear the stored login; slow or offline networks never do. */
export function isAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; status?: number; message?: string; code?: string };
  if (e.name === "AuthRetryableFetchError" || e.message === "Session restore timed out") return false;
  if (e.status === 401 || e.status === 403) return true;
  return /invalid refresh token|refresh token not found|session_not_found|user_not_found|jwt expired|invalid jwt/i.test(`${e.code ?? ""} ${e.message ?? ""}`);
}

export async function restoreSession<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Session restore timed out")), SESSION_RESTORE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** A stuck auth client must be abandoned, not awaited again via signOut(). */
export async function recoverSession(
  clearSession: () => Promise<unknown>,
  returnToSignIn: (path: "/") => void,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(clearSession),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, 2_500); }),
    ]);
  } catch {
    // Storage may be unavailable; never leave the visitor on the spinner.
  } finally {
    clearTimeout(timer);
    returnToSignIn("/");
  }
}

/** Matches the generated client's default, without scanning other stored data. */
export function sessionStorageKey(apiUrl: string): string {
  return `sb-${new URL(apiUrl).hostname.split(".")[0]}-auth-token`;
}