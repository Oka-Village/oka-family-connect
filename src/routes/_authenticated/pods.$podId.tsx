import { createFileRoute, redirect } from "@tanstack/react-router";

import { PodsDetailPage } from "@/components/oka/pods/pods-detail-page";
import { podsUiDisabledRedirect } from "@/lib/pods/access";

export const Route = createFileRoute("/_authenticated/pods/$podId")({
  beforeLoad: () => {
    const to = podsUiDisabledRedirect();
    if (to) throw redirect({ to });
  },
  head: () => ({
    meta: [{ title: "My pod — Oka" }],
  }),
  component: DetailRoute,
});

function DetailRoute() {
  const { podId } = Route.useParams();
  return <PodsDetailPage podId={podId} />;
}
