import { createFileRoute, redirect } from "@tanstack/react-router";

import { PodsCreatePage } from "@/components/oka/pods/pods-create-page";
import { podsUiDisabledRedirect, canCreatePods } from "@/lib/pods/access";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pods/new")({
  beforeLoad: async () => {
    const to = podsUiDisabledRedirect();
    if (to) throw redirect({ to });

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/" });

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
    const set = new Set((roles ?? []).map((r) => r.role));
    if (
      !canCreatePods({
        isStaff: set.has("admin") || set.has("moderator"),
        isFacilitator: set.has("facilitator"),
      })
    ) {
      throw redirect({ to: "/pods" });
    }
  },
  head: () => ({
    meta: [{ title: "Create a pod — Oka" }],
  }),
  component: PodsCreatePage,
});
