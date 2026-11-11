import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old welcome links land on Home, which now carries the make-yourself-at-home hub. */
export const Route = createFileRoute("/_authenticated/welcome")({
  beforeLoad: () => {
    throw redirect({ to: "/home", replace: true });
  },
  component: () => null,
});
