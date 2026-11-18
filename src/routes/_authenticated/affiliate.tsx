import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/affiliate")({
  beforeLoad: () => {
    throw redirect({ to: "/earnings", replace: true });
  },
});
