import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationRow } from "@/components/oka/notification-row";
import { listNotifications, markAllRead } from "@/lib/notifications.functions";
import { unreadBadge } from "@/lib/notifications";

const PREVIEW_COUNT = 5;

export function NotificationsBell({ userId }: { userId: string | undefined }) {
  const list = useServerFn(listNotifications);
  const markRead = useServerFn(markAllRead);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const queryKey = ["notifications", userId];
  const { data } = useQuery({
    queryKey,
    queryFn: () => list(),
    enabled: Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: () => markRead(),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(queryKey, (previous: typeof data | undefined) =>
        previous
          ? {
              ...previous,
              notifications: previous.notifications.map((notification) => ({
                ...notification,
                read_at: notification.read_at ?? new Date().toISOString(),
              })),
            }
          : previous,
      );
    },
  });

  if (!userId) return null;
  const notifications = data?.notifications ?? [];
  const badge = unreadBadge(notifications);
  const preview = notifications.slice(0, PREVIEW_COUNT);
  const hasUnread = Boolean(badge);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-11 shrink-0 rounded-full"
          aria-label={badge ? `Notifications, ${badge} unread` : "Notifications"}
        >
          <Bell className="size-5 text-primary" strokeWidth={1.5} />
          {badge && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] text-primary-foreground"
            >
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-border bg-card p-0 text-card-foreground shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="font-serif text-xl text-foreground">Notifications</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-xs text-primary hover:bg-transparent hover:text-primary/80"
            disabled={!hasUnread || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Mark all as read
          </Button>
        </div>
        {preview.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell className="mx-auto size-6 text-primary" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          <ul className="max-h-[min(28rem,70vh)] divide-y divide-border overflow-y-auto">
            {preview.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} compact />
            ))}
          </ul>
        )}
        <div className="border-t border-border px-4 py-3 text-center">
          <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-sm text-primary hover:bg-transparent">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              See all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
