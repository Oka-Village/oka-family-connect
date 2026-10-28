import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Bell, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow, isValid, parseISO } from "date-fns";
import { listNotifications, markAllRead } from "@/lib/notifications.functions";
import { notificationLink } from "@/lib/notifications";
import { Button } from "@/components/ui/button";

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
  useEffect(() => {
    if (!data.available) return;
    void markRead().then((result) => {
      if (result.ok) queryClient.setQueryData(["notifications", user.id], (previous: typeof data | undefined) => previous ? {
        ...previous, notifications: previous.notifications.map((notification) => ({ ...notification, read_at: notification.read_at ?? new Date().toISOString() })),
      } : previous);
    }).catch(() => { /* Unavailable tables and transient errors stay gentle. */ });
  }, [data.available, markRead, queryClient, user.id]);

  return <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
    <p className="section-label">Your Oka</p>
    <h1 className="mt-3 text-4xl text-foreground">Notifications</h1>
    {data.notifications.length === 0 ? <div className="mt-12 flex flex-col items-center py-12 text-center">
      <Bell className="size-8 text-primary" strokeWidth={1.5} />
      <h2 className="mt-5 text-2xl text-foreground">A quiet moment</h2>
      <p className="mt-3 text-sm text-muted-foreground">No notifications yet.</p>
    </div> : <ul className="mt-8 divide-y divide-border">
      {data.notifications.map((notification) => {
        const link = notificationLink(notification.link);
        const created = parseISO(notification.created_at);
        return <li key={notification.id} className="py-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="min-w-0 break-words text-xl text-foreground">{notification.title}</h2>
            {isValid(created) && <time dateTime={notification.created_at} className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(created, { addSuffix: true })}</time>}
          </div>
          {notification.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{notification.body}</p>}
          {link && <Button asChild variant="link" className="mt-2 h-auto px-0"><Link to={link}>View update <ArrowUpRight className="size-4" strokeWidth={1.5} /></Link></Button>}
        </li>;
      })}
    </ul>}
  </div>;
}