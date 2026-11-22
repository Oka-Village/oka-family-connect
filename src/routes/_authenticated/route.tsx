import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { AppShell } from "@/components/oka/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { saveReturnTo } from "@/lib/join-link";

/**
 * Gate for every signed-in surface. Client-only because the Supabase session
 * lives in browser storage.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const next = location.href.startsWith("/") ? location.href.split("#")[0] ?? location.pathname : location.pathname;
      saveReturnTo(next);
      throw redirect({ to: "/" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Onboarding is a full-bleed experience: no navigation around it.
  if (pathname.startsWith("/onboarding")) {
    return <Outlet />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
