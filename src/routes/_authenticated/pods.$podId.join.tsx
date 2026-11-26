import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PodsJoinPage } from "@/components/oka/pods/pods-join-page";
import { podsUiDisabledRedirect } from "@/lib/pods/access";
import { getPod } from "@/lib/pods/pods.functions";

export const Route = createFileRoute("/_authenticated/pods/$podId/join")({
  beforeLoad: ({ params }) => {
    const to = podsUiDisabledRedirect();
    if (to) throw redirect({ to });
    if (!params.podId) throw redirect({ to: "/pods" });
  },
  head: () => ({
    meta: [
      { title: "Join a pod — Oka" },
      {
        name: "description",
        content: "Confirm your commitments and take your seat in an Oka pod.",
      },
    ],
  }),
  component: JoinRoute,
});

function JoinRoute() {
  const { podId } = Route.useParams();
  const query = useQuery({
    queryKey: ["pod", podId, "join"],
    queryFn: () => getPod({ data: { podId } }),
  });

  if (query.isLoading) {
    return <div className="pods-ui p-8 text-sm">Loading…</div>;
  }
  if (query.isError || !query.data?.pod || query.data.pod.status !== "published") {
    return (
      <div className="pods-ui p-8">
        <p className="text-sm text-[color:var(--pods-ink-fire)]" role="alert">
          This pod isn’t open to join.
        </p>
        <a href="/pods" className="mt-4 inline-block text-sm underline">
          Back to pods
        </a>
      </div>
    );
  }

  return <PodsJoinPage detail={query.data} />;
}
