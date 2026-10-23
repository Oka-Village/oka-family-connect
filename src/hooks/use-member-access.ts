import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useRoles } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { canAccessMemberRoute, FULL_ACCESS_OPENS_AT, isFullMember, ownEditTarget } from "@/lib/member-access";

export function useMemberAccess(pathname: string) {
  const profile = useProfile();
  const roles = useRoles();
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
  const fullAccess = roles.data?.isStaff === true || isFullMember(profile.data, now);
  const edit = ownEditTarget(pathname);
  const ownership = useQuery({
    queryKey: ["member-edit-access", profile.data?.id, edit?.table, edit?.id],
    enabled: Boolean(!fullAccess && profile.data && edit),
    queryFn: async () => {
      if (!edit || !profile.data) return false;
      if (edit.table === "events") {
        const { data, error } = await supabase.from("events").select("created_by,host_id").eq("id", edit.id).maybeSingle();
        if (error) throw error;
        return data?.created_by === profile.data.id || data?.host_id === profile.data.id;
      }
      const { data, error } = await supabase.from(edit.table).select("owner_id").eq("id", edit.id).maybeSingle();
      if (error) throw error;
      return data?.owner_id === profile.data.id;
    },
  });
  return {
    fullAccess,
    isLoading: profile.isPending || roles.isPending || Boolean(!fullAccess && edit && ownership.isPending && profile.data),
    isError: profile.isError || roles.isError || ownership.isError,
    allowed: Boolean(profile.data && canAccessMemberRoute(pathname, fullAccess, ownership.data === true)),
    retry: () => { void profile.refetch(); void roles.refetch(); if (edit) void ownership.refetch(); },
  };
}