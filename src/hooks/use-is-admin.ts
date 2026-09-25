import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Roles = { isAdmin: boolean; isModerator: boolean; isStaff: boolean };

/** The signed-in member's roles, read from user_roles under RLS (never from the profile). */
export function useRoles() {
  return useQuery({
    queryKey: ["my-roles"],
    queryFn: async (): Promise<Roles> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { isAdmin: false, isModerator: false, isStaff: false };
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
      const set = new Set((data ?? []).map((r) => r.role));
      const isAdmin = set.has("admin");
      const isModerator = set.has("moderator");
      return { isAdmin, isModerator, isStaff: isAdmin || isModerator };
    },
    staleTime: 5 * 60_000,
  });
}

/** Admins and moderators: can publish, edit and moderate events. */
export function useIsStaff() {
  const q = useRoles();
  return { ...q, data: q.data?.isStaff };
}

export function useCurrentUserId() {
  return useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });
}
