"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DateTime,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PageHeader,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { wireLabel } from "@/lib/format/wire-label";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { PriorityBadge } from "../components/NotificationList";
import { useNotificationDetail } from "./hooks/useNotificationDetail";

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { t, lang, notification, status, error, isPending, markRead, acknowledge, dismiss, reload } =
    useNotificationDetail(id);

  return (
    <PermissionGate require="notifications.notification.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={notification?.title ?? t.coreNotifications.detailTitle}
          description={t.coreNotifications.detailSubtitle}
          leading={
            <Button variant="ghost" size="sm" asChild aria-label={t.common.back}>
              <Link href={TENANT_ROUTES.coreNotifications}>
                <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            </Button>
          }
          titleAdornment={
            notification && notification.readAt === null ? (
              <Badge tone="brand">{t.coreNotifications.unread}</Badge>
            ) : undefined
          }
          secondaryActions={
            notification ? (
              <span className="flex flex-wrap items-center gap-2">
                {notification.readAt === null ? (
                  <Button variant="outline" onClick={() => void markRead()} disabled={isPending}>
                    <Check className="size-4" aria-hidden="true" />
                    {t.coreNotifications.markRead}
                  </Button>
                ) : null}
                {notification.acknowledgedAt === null ? (
                  <Button variant="outline" onClick={() => void acknowledge()} disabled={isPending}>
                    <CheckCheck className="size-4" aria-hidden="true" />
                    {t.coreNotifications.acknowledge}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => void dismiss()} disabled={isPending}>
                  <X className="size-4" aria-hidden="true" />
                  {t.coreNotifications.dismiss}
                </Button>
              </span>
            ) : undefined
          }
        />

        {status === "loading" ? <Skeleton className="h-48 w-full" /> : null}

        {status === "notFound" ? (
          <NotFoundState
            title={t.coreNotifications.detailNotFoundTitle}
            description={t.coreNotifications.detailNotFoundDescription}
            backLabel={t.coreNotifications.backToInbox}
            backHref={TENANT_ROUTES.coreNotifications}
          />
        ) : null}

        {status === "failed" ? (
          <ErrorState
            title={t.coreNotifications.loadFailed}
            description={error?.message}
            onRetry={() => void reload()}
            retryLabel={t.common.retry}
          />
        ) : null}

        {notification ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t.coreNotifications.detailBody}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-foreground">{notification.body}</p>
                {notification.actionUrl ? (
                  <Button variant="link" asChild className="mt-3">
                    {/* Validated same-origin at the boundary; an unsafe route
                        never survives the schema, so it never becomes an href. */}
                    <Link href={notification.actionUrl}>
                      {t.coreNotifications.detailOpenTarget}
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.coreNotifications.detailFacts}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <DetailRow label={t.coreNotifications.detailType}>
                  <IdentifierText className="text-xs">{notification.notificationType}</IdentifierText>
                </DetailRow>
                <DetailRow label={t.coreNotifications.detailPriority}>
                  <PriorityBadge priority={notification.priority} />
                </DetailRow>
                <DetailRow label={t.coreNotifications.detailSource}>
                  <IdentifierText className="text-xs">{notification.sourceApp}</IdentifierText>
                </DetailRow>
                <DetailRow label={t.coreNotifications.detailChannels}>
                  <span className="flex flex-wrap gap-1">
                    {notification.channels.map((channel) => (
                      <Badge key={channel} tone="neutral">
                        {wireLabel(
                          t.coreNotifications.channelNames,
                          channel,
                          t.common.unknownCode,
                          "coreNotifications.channelNames",
                        )}
                      </Badge>
                    ))}
                  </span>
                </DetailRow>
                <DetailRow label={t.coreNotifications.detailCreated}>
                  <DateTime value={notification.createdAt} precision="datetime" language={lang} />
                </DetailRow>
                <DetailRow label={t.coreNotifications.detailRead}>
                  {notification.readAt ? (
                    <DateTime value={notification.readAt} precision="datetime" language={lang} />
                  ) : (
                    <span className="text-muted-foreground">{t.coreNotifications.unread}</span>
                  )}
                </DetailRow>
                <DetailRow label={t.coreNotifications.detailAcknowledged}>
                  {notification.acknowledgedAt ? (
                    <DateTime
                      value={notification.acknowledgedAt}
                      precision="datetime"
                      language={lang}
                    />
                  ) : (
                    <span className="text-muted-foreground">{t.coreNotifications.notAcknowledged}</span>
                  )}
                </DetailRow>
                {notification.entityType && notification.entityId ? (
                  <DetailRow label={t.coreNotifications.detailEntity}>
                    <IdentifierText className="text-xs">
                      {`${notification.entityType} · ${notification.entityId}`}
                    </IdentifierText>
                  </DetailRow>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </PermissionGate>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-xs last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </div>
  );
}
