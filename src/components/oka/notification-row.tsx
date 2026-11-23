import { Link } from "@tanstack/react-router";
import { Bell, Check, RefreshCw, X } from "lucide-react";
import { formatDistanceToNow, isValid, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  notificationDisplayBody,
  notificationLink,
  notificationPresentation,
  type NotificationIconKind,
  type NotificationTone,
  type OkaNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

const TONE_TILE: Record<NotificationTone, string> = {
  warm: "bg-primary/15 text-primary",
  muted: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  primary: "bg-primary/15 text-primary",
};

function TypeIcon({ kind }: { kind: NotificationIconKind }) {
  const className = "size-4";
  switch (kind) {
    case "reschedule":
      return <RefreshCw className={className} strokeWidth={1.75} aria-hidden="true" />;
    case "cancelled":
      return <X className={className} strokeWidth={1.75} aria-hidden="true" />;
    case "approved":
      return <Check className={className} strokeWidth={1.75} aria-hidden="true" />;
    case "reminder":
      return <span className="text-[0.65rem] font-semibold leading-none" aria-hidden="true">1h</span>;
    default:
      return <Bell className={className} strokeWidth={1.75} aria-hidden="true" />;
  }
}

export function NotificationRow({
  notification,
  compact = false,
}: {
  notification: OkaNotification;
  compact?: boolean;
}) {
  const presentation = notificationPresentation(notification.type, notification.link);
  const link = notificationLink(notification.link);
  const body = notificationDisplayBody(notification.body);
  const created = parseISO(notification.created_at);
  const unread = notification.read_at === null;

  return (
    <li className={cn("flex gap-3", compact ? "px-4 py-3.5" : "py-5")}>
      <span
        className={cn(
          "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg",
          TONE_TILE[presentation.tone],
        )}
        aria-hidden="true"
      >
        <TypeIcon kind={presentation.icon} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className={cn("min-w-0 text-sm font-semibold text-foreground", !compact && "text-base")}>
            <span className="break-words">{notification.title}</span>
            {unread && (
              <span
                className="ml-2 inline-block size-1.5 shrink-0 rounded-full bg-primary align-middle"
                aria-label="Unread"
              />
            )}
          </h3>
          {isValid(created) && (
            <time
              dateTime={notification.created_at}
              className="shrink-0 pt-0.5 text-xs text-muted-foreground"
            >
              {formatDistanceToNow(created, { addSuffix: true })}
            </time>
          )}
        </div>
        {body && (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {body}
          </p>
        )}
        {link && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to={link}>{presentation.ctaLabel}</Link>
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
