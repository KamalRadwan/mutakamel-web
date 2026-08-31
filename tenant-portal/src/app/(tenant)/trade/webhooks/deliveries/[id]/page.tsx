"use client";

import { use, useCallback, useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import {
  Badge,
  Button,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PermissionGate,
  ReasonDialog,
  Skeleton,
  Timeline,
  useToast,
} from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeGet, tradeIfMatch, tradePost } from "../../../trade-api";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  RETRYABLE_RETRY_CLASSES,
  WEBHOOK_MANAGE_PERMISSION,
  WEBHOOK_REPLAY_PERMISSION,
  buildRetryDeliveryRequest,
  parseWebhookDeliveryDetail,
  webhookDeliveryPath,
  webhookDeliveryRetryPath,
  webhookFormMessage,
  webhookMessage,
  type WebhookDeliveryDetail,
} from "../../webhook-contract";

const DETAIL_RESPONSE_LIMIT_BYTES = 400_000;

export default function WebhookDeliveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [delivery, setDelivery] = useState<WebhookDeliveryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [retryOpen, setRetryOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    WEBHOOK_MANAGE_PERMISSION,
  );
  const canReplay = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    WEBHOOK_REPLAY_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(webhookDeliveryPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        });
        setDelivery(parseWebhookDeliveryDetail(response.data));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const retry = async (reasonCode: string): Promise<void> => {
    if (!canReplay || !delivery || isRetrying) return;
    setIsRetrying(true);
    setActionError(null);
    try {
      await tradePost(webhookDeliveryRetryPath(delivery.id), buildRetryDeliveryRequest(reasonCode), {
        headers: { ...scope.headers, "If-Match": tradeIfMatch(delivery.version) },
        maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
      });
      setRetryOpen(false);
      toast.success(t.tradeCommon.savedTitle, t.tradeAutomation.retryAccepted);
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        setActionError(webhookMessage(normalized, t) ?? webhookFormMessage(error, t));
      }
    } finally {
      setIsRetrying(false);
      await load();
    }
  };

  // `retryClass` is an open value set whose enum and writers barely overlap,
  // so the control appears only for the two values known to be retryable.
  const lastRetryClass = delivery?.attempts.at(-1)?.retryClass ?? null;
  const isRetryable = lastRetryClass !== null && RETRYABLE_RETRY_CLASSES.includes(lastRetryClass);

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={delivery?.subscriptionCode ?? t.tradeAutomation.deliveryDetailTitle}
        subtitle={delivery?.sourceEventType}
        status={
          delivery ? (
            <Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, delivery.status)}</Badge>
          ) : undefined
        }
        backLabel={t.tradeAutomation.backToDeliveries}
        backHref={TENANT_ROUTES.tradeWebhookDeliveries}
        secondaryActions={
          delivery && canReplay && isRetryable ? (
            <Button variant="outline" loading={isRetrying} onClick={() => setRetryOpen(true)}>
              <RotateCw className="size-4" aria-hidden="true" />
              {t.tradeAutomation.retryDelivery}
            </Button>
          ) : undefined
        }
      />

      {queryError?.status === 404 ? (
        <NotFoundState
          title={t.tradeAutomation.deliveryNotFound}
          description={t.tradeAutomation.deliveryNotFoundDescription}
          backLabel={t.tradeAutomation.backToDeliveries}
          backHref={TENANT_ROUTES.tradeWebhookDeliveries}
        />
      ) : isLoading ? (
        <Skeleton className="h-72" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeAutomation.deliveryLoadFailed}
          description={queryError.message}
          onRetry={() => void load()}
          retryLabel={t.common.retry}
        />
      ) : delivery ? (
        <>
          {actionError ? <DegradedBanner message={actionError} /> : null}
          {delivery.attempts.length > 0 && !isRetryable ? (
            <DegradedBanner message={t.tradeAutomation.retryClassUnknown} />
          ) : null}

          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              {
                label: t.tradeAutomation.endpointUri,
                value: `${delivery.endpoint.origin}${delivery.endpoint.pathname}`,
              },
              { label: t.tradeAutomation.attemptCount, value: String(delivery.attemptCount) },
              {
                label: t.tradeAutomation.nextAttemptAt,
                value: delivery.nextAttemptAt
                  ? formatDateTime(delivery.nextAttemptAt, lang)
                  : null,
              },
              {
                label: t.tradeAutomation.terminalAt,
                value: delivery.terminalAt ? formatDateTime(delivery.terminalAt, lang) : null,
              },
              { label: t.tradeCommon.version, value: String(delivery.version) },
            ]}
          />

          <DetailSection title={t.tradeAutomation.attempts}>
            {delivery.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.tradeAutomation.attemptsEmpty}</p>
            ) : (
              <Timeline
                label={t.tradeAutomation.attempts}
                events={delivery.attempts.map((attempt) => ({
                  id: String(attempt.attemptNumber),
                  title: `#${attempt.attemptNumber} · ${attempt.outcome}`,
                  // retryClass and safeErrorCode are rendered verbatim: source
                  // does not close either value set.
                  description: [
                    attempt.retryClass,
                    attempt.httpStatus === null ? null : String(attempt.httpStatus),
                    attempt.safeErrorCode,
                  ]
                    .filter((part): part is string => part !== null)
                    .join(" · "),
                  timestamp: attempt.startedAt ? formatDateTime(attempt.startedAt, lang) : "—",
                }))}
              />
            )}
          </DetailSection>
        </>
      ) : null}

      <ReasonDialog
        open={retryOpen}
        onOpenChange={(open) => {
          if (!open && !isRetrying) setRetryOpen(false);
        }}
        title={t.tradeAutomation.retryDelivery}
        description={t.tradeAutomation.retryDescription}
        reasonRequired
        maxLength={100}
        onConfirm={(reason) => void retry(reason)}
        loading={isRetrying}
        labels={{
          reason: t.tradeInventory.reasonCode,
          reasonHint: t.tradeInventory.reasonCodeHint,
          confirm: t.tradeCommon.confirm,
          cancel: t.common.cancel,
        }}
      />
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={WEBHOOK_MANAGE_PERMISSION}>{content}</PermissionGate>
  );
}
