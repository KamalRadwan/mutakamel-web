"use client";

import { use, useState } from "react";
import { KeyRound, Power, Send, ShieldOff } from "lucide-react";
import {
  Badge,
  Button,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  Field,
  Input,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { WEBHOOK_MANAGE_PERMISSION } from "../webhook-contract";
import { useWebhookSubscription } from "./hooks/useWebhookSubscription";

export default function WebhookSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const [overlapHours, setOverlapHours] = useState("24");
  const {
    canManage,
    subscription,
    isLoading,
    queryError,
    isNotFound,
    pending,
    actionError,
    setStatus,
    rotateSecret,
    revokeSecret,
    sendTest,
    reload,
  } = useWebhookSubscription(id);

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={subscription?.code ?? t.tradeAutomation.subscriptionDetailTitle}
        subtitle={
          subscription
            ? `${subscription.endpoint.origin}${subscription.endpoint.pathname}`
            : undefined
        }
        status={
          subscription ? (
            <Badge tone={subscription.status === "ACTIVE" ? "positive" : "neutral"}>
              {tradeStatusLabel(t.tradeStatus, subscription.status, t.common.unknownCode)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeAutomation.backToSubscriptions}
        backHref={TENANT_ROUTES.tradeWebhooks}
        secondaryActions={
          subscription && canManage ? (
            <>
              <Button
                variant="outline"
                disabled={pending !== null}
                loading={pending === "status"}
                onClick={() =>
                  void setStatus(subscription.status === "ACTIVE" ? "DISABLED" : "ACTIVE")
                }
              >
                <Power className="size-4" aria-hidden="true" />
                {subscription.status === "ACTIVE"
                  ? t.tradeAutomation.disable
                  : t.tradeAutomation.enable}
              </Button>
              <Button
                variant="outline"
                disabled={pending !== null}
                loading={pending === "test"}
                onClick={() => void sendTest()}
              >
                <Send className="size-4" aria-hidden="true" />
                {t.tradeAutomation.sendTest}
              </Button>
            </>
          ) : undefined
        }
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeAutomation.subscriptionNotFound}
          description={t.tradeAutomation.subscriptionNotFoundDescription}
          backLabel={t.tradeAutomation.backToSubscriptions}
          backHref={TENANT_ROUTES.tradeWebhooks}
        />
      ) : isLoading ? (
        <Skeleton className="h-72" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeAutomation.subscriptionLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : subscription ? (
        <>
          {actionError ? <DegradedBanner message={actionError} /> : null}

          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradeGovernance.scopeTarget,
                value: tradeStatusLabel(t.tradeStatus, subscription.scopeTarget, t.common.unknownCode),
              },
              {
                label: t.tradeAutomation.retryPolicy,
                value: tradeStatusLabel(t.tradeStatus, subscription.retryPolicyCode, t.common.unknownCode),
              },
              { label: t.tradeAutomation.maxAttempts, value: String(subscription.maxAttempts) },
              { label: t.tradeCommon.version, value: String(subscription.version) },
              {
                label: t.tradeAutomation.events,
                wide: true,
                value:
                  subscription.eventTypes.length === 0 ? null : (
                    <span className="flex flex-wrap gap-1">
                      {subscription.eventTypes.map((eventType) => (
                        <Badge key={eventType} tone="neutral">
                          {eventType}
                        </Badge>
                      ))}
                    </span>
                  ),
              },
            ]}
          />

          <DetailSection
            title={t.tradeAutomation.secret}
            description={t.tradeAutomation.secretNeverReturned}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradeAutomation.secretStatus,
                value: subscription.secretStatus
                  ? tradeStatusLabel(t.tradeStatus, subscription.secretStatus, t.common.unknownCode)
                  : null,
              },
              {
                label: t.tradeAutomation.lastSecretOperation,
                value: subscription.secretOperation
                  ? `${subscription.secretOperation.type} · ${subscription.secretOperation.status}`
                  : null,
              },
              {
                label: t.tradeAutomation.secretOperationError,
                value: subscription.secretOperation?.safeErrorCode ?? null,
              },
            ]}
          >
            <div className="flex flex-wrap items-end gap-3">
              <Field
                label={t.tradeAutomation.overlapHours}
                hint={t.tradeAutomation.overlapHoursHint}
              >
                <Input
                  type="number"
                  min={0}
                  max={168}
                  value={overlapHours}
                  disabled={!canManage || pending !== null}
                  onChange={(event) => setOverlapHours(event.target.value)}
                />
              </Field>
              <Button
                variant="outline"
                disabled={!canManage || pending !== null}
                loading={pending === "rotate"}
                onClick={() => void rotateSecret(overlapHours)}
              >
                <KeyRound className="size-4" aria-hidden="true" />
                {t.tradeAutomation.rotateSecret}
              </Button>
              <Button
                variant="outline"
                disabled={!canManage || pending !== null}
                loading={pending === "revoke"}
                onClick={() => void revokeSecret()}
              >
                <ShieldOff className="size-4" aria-hidden="true" />
                {t.tradeAutomation.revokeSecret}
              </Button>
            </div>
          </DetailSection>
        </>
      ) : null}
    </div>
  );

  return canManage ? (
    content
  ) : (
    <PermissionGate require={WEBHOOK_MANAGE_PERMISSION}>{content}</PermissionGate>
  );
}
