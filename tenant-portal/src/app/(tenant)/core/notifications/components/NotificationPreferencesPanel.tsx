"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Label,
  Skeleton,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { NotificationChannel } from "../notification-contract";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";

const CHANNELS: readonly NotificationChannel[] = ["inApp", "push", "email"];

export function NotificationPreferencesPanel() {
  const { t } = useI18n();
  const {
    canRead,
    canManage,
    preferences,
    channelConfig,
    isLoading,
    error,
    pendingType,
    toggle,
    reload,
  } = useNotificationPreferences();

  if (!canRead) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.coreNotifications.preferencesTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{t.coreNotifications.preferencesForbidden}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.coreNotifications.preferencesTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? <Skeleton className="h-24 w-full" /> : null}

        {error ? (
          <ErrorState
            title={t.coreNotifications.preferencesLoadFailed}
            description={error.message}
            onRetry={() => void reload()}
            retryLabel={t.common.retry}
          />
        ) : null}

        {!isLoading && !error && preferences.length === 0 ? (
          <EmptyState
            title={t.coreNotifications.preferencesEmptyTitle}
            description={t.coreNotifications.preferencesEmptyDescription}
          />
        ) : null}

        {preferences.map((preference) => (
          <div
            key={preference.notificationType}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0"
          >
            <span className="min-w-0 font-mono text-xs text-foreground">
              {preference.notificationType}
            </span>
            <div className="flex flex-wrap items-center gap-4">
              {CHANNELS.map((channel) => (
                <span key={channel} className="flex items-center gap-2">
                  <Label htmlFor={`${preference.notificationType}-${channel}`}>
                    {t.coreNotifications.channelNames[channel]}
                  </Label>
                  <Switch
                    id={`${preference.notificationType}-${channel}`}
                    checked={channelValue(preference, channel)}
                    onCheckedChange={(checked) => void toggle(preference, channel, checked)}
                    // A channel the tenant has switched off entirely cannot be
                    // enabled per type, so the control says so rather than
                    // accepting a change the server will not honour.
                    disabled={
                      !canManage ||
                      pendingType === preference.notificationType ||
                      isChannelDisabled(channelConfig, channel)
                    }
                  />
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function channelValue(
  preference: { inAppEnabled: boolean; pushEnabled: boolean; emailEnabled: boolean },
  channel: NotificationChannel,
): boolean {
  if (channel === "inApp") return preference.inAppEnabled;
  if (channel === "push") return preference.pushEnabled;
  return preference.emailEnabled;
}

function isChannelDisabled(
  config: { enabled: boolean; inAppEnabled: boolean; pushEnabled: boolean; emailEnabled: boolean } | null,
  channel: NotificationChannel,
): boolean {
  if (config === null) return false;
  if (!config.enabled) return true;
  if (channel === "inApp") return !config.inAppEnabled;
  if (channel === "push") return !config.pushEnabled;
  return !config.emailEnabled;
}
