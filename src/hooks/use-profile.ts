// @refresh reset
import { useQuery } from "@tanstack/react-query";
import { initializeNewFlowProfile } from "@/lib/signup-flow.functions";

import { supabase } from "@/integrations/supabase/client";
import type { OkaProfile } from "@/lib/profile";

/** The signed-in member's profile row, or null while signed out. */
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<OkaProfile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;

      // No redirect result: call directly inside the async query, not another hook.
      await initializeNewFlowProfile();

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (error) throw error;
      return (data as OkaProfile | null) ?? null;
    },
  });
}

/** Signed avatar URL for a stored photo reference (path or remote URL). */
export async function resolvePhotoUrl(photoUrl: string | null): Promise<string | null> {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(photoUrl, 60 * 60);
  return data?.signedUrl ?? null;
}
