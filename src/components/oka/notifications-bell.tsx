import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { listNotifications } from "@/lib/notifications.functions";
import { unreadBadge } from "@/lib/notifications";

export function NotificationsBell({ userId }: { userId: string | undefined }) {
  const list = useServerFn(listNotifications);
  const { data } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => list(), enabled: Boolean(userId),
    staleTime: 30_000, refetchOnWindowFocus: true, retry: false,
  });
  if (!userId) return null;
  const badge = unreadBadge(data?.notifications ?? []);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" className="relative size-11 shrink-0 rounded-full">
            <Link to="/notifications" aria-label={badge ? `Notifications, ${badge} unread` : "Notifications"}>
              <Bell className="size-5 text-primary" strokeWidth={1.5} />
              {badge && <span aria-hidden="true" className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] text-primary-foreground">{badge}</span>}
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}