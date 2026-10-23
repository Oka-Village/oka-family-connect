import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMembership(userId: string | undefined) {
  return useQuery({
    queryKey: ["membership", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from("memberships").select("kind,active,current_period_end").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
  });
}