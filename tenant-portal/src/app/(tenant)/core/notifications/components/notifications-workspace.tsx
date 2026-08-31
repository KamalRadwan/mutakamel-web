"use client";

import { RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Label,
  PageHeader,
  PermissionGate,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system";
import { formatNumber } from "@/lib/format/number";
import { DeviceTokensPanel } from "./DeviceTokensPanel";
import { NotificationList } from "./NotificationList";
import { NotificationPreferencesPanel } from "./NotificationPreferencesPanel";
import { useNotificationInbox } from "../hooks/useNotificationInbox";

export function NotificationsWorkspace() {
  const {
    t,
    lang,
    items,
    unreadCount,
    unreadOnly,
    hasMore,
    isLoading,
    isRefreshing,
    isLoadingMore,
    isMarkingAll,
    pendingId,
    error,
    setUnreadOnly,
    loadMore,
    markRead,
    acknowledge,
    dismiss,
    markAllRead,
    reload,
  } = useNotificationInbox();

  return (
    <PermissionGate require="notifications.notification.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t.coreNotifications.title}
          description={t.coreNotifications.subtitle}
          titleAdornment={
            unreadCount > 0 ? <Badge tone="brand">{formatNumber(unreadCount, lang)}</Badge> : undefined
          }
          primaryAction={
            unreadCount > 0
              ? {
                  label: t.common.markAllRead,
                  onClick: () => void markAllRead(),
                  disabled: isMarkingAll,
                  loading: isMarkingAll,
                }
              : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={() => void reload()} disabled={isRefreshing}>
              <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
              {t.coreSettings.reload}
            </Button>
          }
        />

        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox">{t.coreNotifications.tabInbox}</TabsTrigger>
            <TabsTrigger value="preferences">{t.coreNotifications.tabPreferences}</TabsTrigger>
            <TabsTrigger value="devices">{t.coreNotifications.tabDevices}</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="flex flex-col gap-3">
            <span className="flex items-center gap-2">
              <Switch
                id="notifications-unread-only"
                checked={unreadOnly}
                onCheckedChange={setUnreadOnly}
                disabled={isRefreshing}
              />
              <Label htmlFor="notifications-unread-only">{t.coreNotifications.unreadOnly}</Label>
            </span>

            <NotificationList
              items={items}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              pendingId={pendingId}
              error={error}
              onRetry={() => void reload()}
              onLoadMore={() => void loadMore()}
              onMarkRead={(item) => void markRead(item)}
              onAcknowledge={(item) => void acknowledge(item)}
              onDismiss={(item) => void dismiss(item)}
            />
          </TabsContent>

          <TabsContent value="preferences">
            <NotificationPreferencesPanel />
          </TabsContent>

          <TabsContent value="devices">
            <DeviceTokensPanel />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
