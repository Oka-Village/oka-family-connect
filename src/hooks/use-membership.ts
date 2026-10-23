import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/stripe/membership.functions";

export function useMembership(userId: string | undefined) {
  const getMembership = useServerFn(getMyMembership);
  return useQuery({
    queryKey: ["membership", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      return getMembership();
    },
    refetchOnWindowFocus: true,
  });
}