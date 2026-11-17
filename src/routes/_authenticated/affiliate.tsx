import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Invite & earn URL — personal earnings now live at /earnings. */
export const Route = createFileRoute("/_authenticated/affiliate")({
  beforeLoad: () => {
    throw redirect({ to: "/earnings" });
  },
});
