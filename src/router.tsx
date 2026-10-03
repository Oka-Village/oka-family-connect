import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Wordmark } from "@/components/oka/wordmark";

function AppPendingScreen() {
  return (
    <div className="min-h-screen bg-background px-6 py-5 lg:p-3">
      <div className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-[1180px] animate-pulse lg:rounded-2xl lg:border lg:border-border lg:px-10 lg:py-5">
        <div className="flex items-center border-b border-border pb-5">
          <Wordmark />
          <div className="ml-auto h-9 w-24 rounded-full bg-muted" />
        </div>
        <div className="py-12">
          <div className="h-3 w-28 rounded-full bg-muted" />
          <div className="mt-5 h-12 w-full max-w-lg rounded-lg bg-muted" />
          <div className="mt-4 h-4 w-full max-w-md rounded-full bg-muted" />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <div className="h-52 rounded-2xl bg-muted" />
            <div className="h-52 rounded-2xl bg-muted" />
            <div className="h-52 rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 0,
    defaultPendingMinMs: 300,
    defaultPendingComponent: AppPendingScreen,
  });

  return router;
};
