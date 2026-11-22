import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { NotificationRow } from "@/components/oka/notification-row";
import { Button } from "@/components/ui/button";
import { listNotifications, markAllRead } from "@/lib/notifications.functions";
import { unreadBadge } from "@/lib/notifications";

const notificationsOptions = (userId: string) => queryOptions({
  queryKey: ["notifications", userId],
  queryFn: async () => {
    try { return await listNotifications(); }
    catch { return { notifications: [], available: false }; }
  },
});

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [
    { title: "Notifications — Oka" },
    { name: "description", content: "Your latest updates from the Oka family." },
    { property: "og:title", content: "Notifications — Oka" },
    { property: "og:description", content: "Your latest updates from the Oka family." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(notificationsOptions(context.user.id)),
  component: NotificationsPage,
  errorComponent: () => <div className="px-6 py-16 text-center text-muted-foreground">Your updates will be here soon.</div>,
  notFoundComponent: () => <div className="px-6 py-16 text-center text-muted-foreground">No notifications found.</div>,
});

function NotificationsPage() {
  const { user } = getRouteApi("/_authenticated").useRouteContext();
  const { data } = useSuspenseQuery(notificationsOptions(user.id));
  const markRead = useServerFn(markAllRead);
  const queryClient = useQueryClient();
  const queryKey = ["notifications", user.id];
  const hasUnread = Boolean(unreadBadge(data.notifications));
  const mutation = useMutation({
    mutationFn: () => markRead(),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(queryKey, (previous: typeof data | undefined) => previous ? {
        ...previous,
        notifications: previous.notifications.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? new Date().toISOString(),
        })),
      } : previous);
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label">Your Oka</p>
          <h1 className="mt-3 font-serif text-4xl text-foreground">Notifications</h1>
        </div>
        {data.notifications.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-sm text-primary hover:bg-transparent hover:text-primary/80"
            disabled={!hasUnread || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Mark all as read
          </Button>
        )}
      </div>
      {data.notifications.length === 0 ? (
        <div className="mt-12 flex flex-col items-center py-12 text-center">
          <Bell className="size-8 text-primary" strokeWidth={1.5} />
          <h2 className="mt-5 text-2xl text-foreground">A quiet moment</h2>
          <p className="mt-3 text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card px-4 sm:px-5">
          {data.notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </ul>
      )}
    </div>
  );
}
