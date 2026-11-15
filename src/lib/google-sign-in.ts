import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

/** True when the app is pointed at a local Supabase API URL. */
export function isLocalSupabase(url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

/**
 * Opens Google sign-in. Local Supabase uses native GoTrue OAuth;
 * remote keeps the existing Lovable broker.
 */
export async function signInWithGoogle(redirectTo: string): Promise<{ redirected: boolean }> {
  if (isLocalSupabase()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: false },
    });
    if (error) throw error;
    return { redirected: Boolean(data?.url) };
  }

  const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo });
  if (result.error) {
    throw result.error instanceof Error ? result.error : new Error("We couldn’t open Google sign-in. Please try again.");
  }
  return { redirected: Boolean(result.redirected) };
}
