"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DateTime,
  Field,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { DEVICE_TOKEN_PROVIDERS, type DeviceTokenProvider } from "../notification-contract";
import { useDeviceTokens } from "../hooks/useDeviceTokens";

export function DeviceTokensPanel() {
  const { t, lang } = useI18n();
  const { canManage, registered, isSubmitting, revokingId, formError, register, revoke } =
    useDeviceTokens();
  const [provider, setProvider] = useState<DeviceTokenProvider>("web-push");
  const [token, setToken] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [platform, setPlatform] = useState("");

  const submit = async () => {
    if (await register(provider, token, deviceId, platform)) {
      setToken("");
      setDeviceId("");
      setPlatform("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.coreNotifications.deviceTokensTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* The Core contract has no device-token listing route, so this panel
            can only show what this session registered. Saying so beats
            rendering an empty list that implies "no devices". */}
        <p className="text-xs text-muted-foreground">{t.coreNotifications.deviceTokensNote}</p>

        {canManage ? (
          <>
            <Field label={t.coreNotifications.deviceTokenProvider}>
              <Select
                value={provider}
                onValueChange={(value) => setProvider(value as DeviceTokenProvider)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TOKEN_PROVIDERS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t.coreNotifications.deviceProviderNames[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t.coreNotifications.deviceToken}
              hint={t.coreNotifications.deviceTokenHint}
              error={formError ?? undefined}
              required
            >
              <Input
                dir="ltr"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                maxLength={4096}
                disabled={isSubmitting}
                required
              />
            </Field>

            <Field label={t.coreNotifications.deviceId}>
              <Input
                dir="ltr"
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                maxLength={128}
                disabled={isSubmitting}
              />
            </Field>

            <Field label={t.coreNotifications.devicePlatform}>
              <Input
                dir="ltr"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                maxLength={32}
                disabled={isSubmitting}
              />
            </Field>

            <Button
              variant="outline"
              onClick={() => void submit()}
              loading={isSubmitting}
              className="self-start"
            >
              {t.coreNotifications.deviceTokenRegister}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t.coreNotifications.deviceTokensForbidden}</p>
        )}

        {registered.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"
          >
            <span className="flex min-w-0 flex-col">
              <IdentifierText className="text-xs text-foreground">{item.tokenHash}</IdentifierText>
              <span className="text-2xs text-muted-foreground">
                <DateTime value={item.lastSeenAt} precision="datetime" language={lang} />
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.coreNotifications.deviceTokenRevoke}
              loading={revokingId === item.id}
              disabled={revokingId !== null}
              onClick={() => void revoke(item)}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
