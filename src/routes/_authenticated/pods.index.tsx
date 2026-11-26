import { createFileRoute, redirect } from "@tanstack/react-router";

import { PodsListPage } from "@/components/oka/pods/pods-list-page";
import { podsUiDisabledRedirect } from "@/lib/pods/access";

export const Route = createFileRoute("/_authenticated/pods/")({
  beforeLoad: () => {
    const to = podsUiDisabledRedirect();
    if (to) throw redirect({ to });
  },
  head: () => ({
    meta: [
      { title: "Pods — Oka" },
      {
        name: "description",
        content:
          "Three encounters, one small circle — join an Oka pod with the same people each time.",
      },
    ],
  }),
  component: PodsListPage,
});
