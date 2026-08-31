"use client";

import { use, useCallback, useEffect, useState } from "react";
import { CheckCircle2, RotateCw } from "lucide-react";
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
import { tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  CONTROL_TOWER_READ_PERMISSION,
  CONTROL_TOWER_RESOLVE_PERMISSION,
  CONTROL_TOWER_RETRY_PERMISSION,
  RETRYABLE_RETRY_CLASSES,
  buildResolveExceptionRequest,
  buildRetryExceptionRequest,
  controlTowerActionPath,
  controlTowerExceptionPath,
  controlTowerFormMessage,
  controlTowerMessage,
  parseControlTowerExceptionDetail,
  type ControlTowerExceptionDetail,
} from "../control-tower-contract";

const DETAIL_RESPONSE_LIMIT_BYTES = 400_000;

export default function ControlTowerExceptionPage({
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

  const [exception, setException] = useState<ControlTowerExceptionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [dialog, setDialog] = useState<"retry" | "resolve" | null>(null);
  const [pending, setPending] = useState<"retry" | "resolve" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    CONTROL_TOWER_READ_PERMISSION,
  );
  const canRetry = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    CONTROL_TOWER_RETRY_PERMISSION,
  );
  const canResolve = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    CONTROL_TOWER_RESOLVE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(controlTowerExceptionPath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        });
        setException(parseControlTowerExceptionDetail(response.data));
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

  const act = async (action: "retry" | "resolve", reason: string): Promise<void> => {
    if (!exception || pending) return;
    setPending(action);
    setActionError(null);
    try {
      await tradePost(
        controlTowerActionPath(exception.id, action),
        action === "retry"
          ? buildRetryExceptionRequest(reason)
          : // Evidence is required on resolve. It is sent as an empty object
            // when the operator has none: the DTO forbids omitting the key.
            buildResolveExceptionRequest("SOURCE_CORRECTED", reason, "{}"),
        {
          headers: { ...scope.headers, "If-Match": tradeIfMatch(exception.version) },
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        },
      );
      setDialog(null);
      toast.success(
        t.tradeCommon.savedTitle,
        action === "retry" ? t.tradeControlTower.retryAccepted : t.tradeControlTower.resolved,
      );
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        setActionError(controlTowerMessage(normalized, t) ?? controlTowerFormMessage(error, t));
      }
    } finally {
      setPending(null);
      await load();
    }
  };

  const isRetryable =
    exception !== null && RETRYABLE_RETRY_CLASSES.includes(exception.retryClass);

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={exception?.category ?? t.tradeControlTower.detailTitle}
        subtitle={exception?.sourceOwner}
        status={
          exception ? (
            <Badge tone={exception.status === "RESOLVED" ? "positive" : "caution"}>
              {tradeStatusLabel(t.tradeStatus, exception.status)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeControlTower.backToList}
        backHref={TENANT_ROUTES.tradeControlTower}
        secondaryActions={
          exception ? (
            <>
              {canRetry && isRetryable ? (
                <Button
                  variant="outline"
                  disabled={pending !== null}
                  loading={pending === "retry"}
                  onClick={() => setDialog("retry")}
                >
                  <RotateCw className="size-4" aria-hidden="true" />
                  {t.tradeControlTower.retry}
                </Button>
              ) : null}
              {canResolve && exception.status !== "RESOLVED" ? (
                <Button
                  variant="outline"
                  disabled={pending !== null}
                  loading={pending === "resolve"}
                  onClick={() => setDialog("resolve")}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t.tradeControlTower.resolve}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />

      {queryError?.status === 404 ? (
        <NotFoundState
          title={t.tradeControlTower.notFound}
          description={t.tradeControlTower.notFoundDescription}
          backLabel={t.tradeControlTower.backToList}
          backHref={TENANT_ROUTES.tradeControlTower}
        />
      ) : isLoading ? (
        <Skeleton className="h-72" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeControlTower.detailLoadFailed}
          description={queryError.message}
          onRetry={() => void load()}
          retryLabel={t.common.retry}
        />
      ) : exception ? (
        <>
          {actionError ? <DegradedBanner message={actionError} /> : null}
          {!isRetryable ? (
            <DegradedBanner message={t.tradeControlTower.retryClassUnknown} />
          ) : null}

          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              { label: t.tradeControlTower.sourceType, value: exception.sourceType },
              { label: t.tradeControlTower.sourceId, value: exception.sourceId },
              {
                label: t.tradeControlTower.severity,
                value: exception.severity === "" ? null : exception.severity,
              },
              {
                label: t.tradeControlTower.retryClass,
                value: exception.retryClass === "" ? null : exception.retryClass,
              },
              { label: t.tradeControlTower.safeErrorCode, value: exception.safeErrorCode },
              { label: t.errors.reference, value: exception.correlationId },
              {
                label: t.tradeControlTower.asOf,
                value: formatDateTime(exception.asOf, lang),
              },
            ]}
          />

          <DetailSection title={t.tradeControlTower.attempts}>
            {exception.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.tradeControlTower.attemptsEmpty}</p>
            ) : (
              <Timeline
                label={t.tradeControlTower.attempts}
                events={exception.attempts.map((attempt) => ({
                  id: attempt.id,
                  title: `${attempt.ownerCode} · ${tradeStatusLabel(t.tradeStatus, attempt.status)}`,
                  description: [attempt.retryClass, attempt.lastErrorCode]
                    .filter((part): part is string => part !== null)
                    .join(" · "),
                  timestamp: formatDateTime(attempt.updatedAt, lang),
                }))}
              />
            )}
          </DetailSection>
        </>
      ) : null}

      <ReasonDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && pending === null) setDialog(null);
        }}
        title={dialog === "resolve" ? t.tradeControlTower.resolve : t.tradeControlTower.retry}
        description={
          dialog === "resolve"
            ? t.tradeControlTower.resolveDescription
            : t.tradeControlTower.retryDescription
        }
        reasonRequired={dialog === "resolve"}
        maxLength={240}
        onConfirm={(reason) => void act(dialog ?? "retry", reason)}
        loading={pending !== null}
        labels={{
          reason: t.tradeGovernance.reason,
          reasonHint: t.tradeControlTower.reasonHint,
          confirm: t.tradeCommon.confirm,
          cancel: t.common.cancel,
        }}
      />
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={CONTROL_TOWER_READ_PERMISSION}>{content}</PermissionGate>
  );
}
