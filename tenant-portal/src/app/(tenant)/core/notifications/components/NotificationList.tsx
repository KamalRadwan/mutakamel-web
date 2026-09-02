"use client";

import Link from "next/link";
import { BellOff, Check, CheckCheck, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DateTime,
  EmptyState,
  ErrorState,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { wireLabel } from "@/lib/format/wire-label";
import { KNOWN_NOTIFICATION_PRIORITY, type InboxNotification } from "../notification-contract";

interface NotificationListProps {
  items: InboxNotification[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  pendingId: string | null;
  error: NormalizedApiError | null;
  onRetry: () => void;
  onLoadMore: () => void;
  onMarkRead: (item: InboxNotification) => void;
  onAcknowledge: (item: InboxNotification) => void;
  onDismiss: (item: InboxNotification) => void;
}

export function NotificationList({
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  pendingId,
  error,
  onRetry,
  onLoadMore,
  onMarkRead,
  onAcknowledge,
  onDismiss,
}: NotificationListProps) {
  const { t, lang } = useI18n();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t.coreNotifications.loadFailed}
        description={error.message}
        onRetry={onRetry}
        retryLabel={t.common.retry}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyState icon={BellOff} title={t.coreNotifications.emptyTitle} description={t.coreNotifications.emptyDescription} />;
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/core/notifications/${item.id}`}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {item.title}
                </Link>
                {item.readAt === null ? (
                  <Badge tone="brand">{t.coreNotifications.unread}</Badge>
                ) : null}
                {item.acknowledgedAt !== null ? (
                  <Badge tone="positive">{t.coreNotifications.acknowledged}</Badge>
                ) : null}
                <PriorityBadge priority={item.priority} />
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
              <p className="text-2xs text-muted-foreground">
                <DateTime value={item.createdAt} precision="datetime" language={lang} />
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {item.readAt === null ? (
                <RowAction
                  label={t.coreNotifications.markRead}
                  disabled={pendingId !== null}
                  loading={pendingId === item.id}
                  onClick={() => onMarkRead(item)}
                >
                  <Check className="size-4" aria-hidden="true" />
                </RowAction>
              ) : null}
              {item.acknowledgedAt === null ? (
                <RowAction
                  label={t.coreNotifications.acknowledge}
                  disabled={pendingId !== null}
                  loading={pendingId === item.id}
                  onClick={() => onAcknowledge(item)}
                >
                  <CheckCheck className="size-4" aria-hidden="true" />
                </RowAction>
              ) : null}
              <RowAction
                label={t.coreNotifications.dismiss}
                disabled={pendingId !== null}
                loading={pendingId === item.id}
                onClick={() => onDismiss(item)}
              >
                <X className="size-4" aria-hidden="true" />
              </RowAction>
            </div>
          </CardContent>
        </Card>
      ))}

      {hasMore ? (
        <Button variant="outline" onClick={onLoadMore} loading={isLoadingMore} className="self-center">
          {t.coreNotifications.loadMore}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * `P2_NORMAL` is the only value the backend is proven to emit. Anything else
 * still shows its code — a new server priority must be visible rather than
 * silently swallowed, the `StatusBadge` rule from docs/design/patterns.md —
 * but inside a TRANSLATED frame rather than as a bare English token, and it
 * warns once so the missing dictionary entry is discoverable.
 */
export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useI18n();

  if (priority === KNOWN_NOTIFICATION_PRIORITY) {
    return <Badge tone="neutral">{t.coreNotifications.priorityNormal}</Badge>;
  }
  return (
    <Badge tone="neutral">
      {wireLabel(
        { [KNOWN_NOTIFICATION_PRIORITY]: t.coreNotifications.priorityNormal },
        priority,
        t.common.unknownCode,
        "coreNotifications.priority",
      )}
    </Badge>
  );
}

function RowAction({
  label,
  disabled,
  loading,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          disabled={disabled}
          loading={loading}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
