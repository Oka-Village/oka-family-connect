import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useRoles } from "@/hooks/use-is-admin";
import { useMembership } from "@/hooks/use-membership";
import { hasPaidMembership } from "@/lib/membership";
import { supabase } from "@/integrations/supabase/client";
import { canAccessMemberRoute, FULL_ACCESS_OPENS_AT, isFullMember, ownEditTarget, ownEventViewTarget } from "@/lib/member-access";

export function useMemberAccess(pathname: string) {
  const profile = useProfile();
  const roles = useRoles();
  const membership = useMembership(profile.data?.id);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const current = new Date();
      setNow(current);
      clearTimeout(timer);
      const remaining = Date.parse(FULL_ACCESS_OPENS_AT) - current.getTime();
      if (remaining > 0) timer = setTimeout(refresh, Math.min(remaining, 2_147_483_647));
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const fullAccess = roles.data?.isStaff === true || isFullMember(profile.data, now, hasPaidMembership(membership.data, now));
  const edit = ownEditTarget(pathname);
  const eventView = ownEventViewTarget(pathname);
  const owned = edit ?? (eventView ? { table: "events" as const, id: eventView.id } : null);
  const ownership = useQuery({
    queryKey: ["member-edit-access", profile.data?.id, owned?.table, owned?.id],
    enabled: Boolean(!fullAccess && profile.data && owned),
    queryFn: async () => {
      if (!owned || !profile.data) return false;
      if (owned.table === "events") {
        const { data, error } = await supabase.from("events").select("created_by,host_id").eq("id", owned.id).maybeSingle();
        if (error) throw error;
        return data?.created_by === profile.data.id || data?.host_id === profile.data.id;
      }
      const { data, error } = await supabase.from(owned.table).select("owner_id").eq("id", owned.id).maybeSingle();
      if (error) throw error;
      return data?.owner_id === profile.data.id;
    },
  });
  const invited = useQuery({
    queryKey: ["event-link-visit", profile.data?.id, eventView?.id],
    enabled: Boolean(!fullAccess && profile.data && eventView),
    retry: false,
    queryFn: async () => {
      if (!eventView || !profile.data) return false;
      const { data, error } = await supabase.from("event_link_visits").select("event_id").eq("user_id", profile.data.id).eq("event_id", eventView.id).maybeSingle();
      // The visit table may not exist on the live database yet. That hides only this exception.
      if (error) return false;
      return Boolean(data);
    },
  });
  return {
    fullAccess,
    isLoading: profile.isPending || roles.isPending || Boolean(profile.data?.member_status === "limited" && membership.isPending) || Boolean(!fullAccess && owned && ownership.isPending && profile.data) || Boolean(!fullAccess && eventView && invited.isPending && profile.data),
    isError: profile.isError || roles.isError || ownership.isError || Boolean(profile.data?.member_status === "limited" && membership.isError),
    allowed: Boolean(profile.data && canAccessMemberRoute(pathname, fullAccess, ownership.data === true, invited.data === true)),
    retry: () => { void profile.refetch(); void roles.refetch(); void membership.refetch(); if (owned) void ownership.refetch(); if (eventView) void invited.refetch(); },
  };
}