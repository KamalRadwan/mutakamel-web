"use client";

import {
  AlertTriangle,
  ArrowRight,
  CircleAlert,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  Badge,
  Button,
  DateTime,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IdentifierText,
  SWATCH_SURFACE_PALETTES,
  cn,
  mirrorInRtl,
} from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import type {
  TenantAvailableUpdate,
  TenantOperationStatus,
  TenantProvisioningOperationView,
} from "../provisioning-updates-contract";
import {
  classifyOperationSurface,
  formatOperationGuidance,
  formatOperationPhaseLabel,
  formatOperationStatusLabel,
  formatOwnerAppLabel,
  operationTone,
  type OperationSurfaceKind,
} from "../updates-labels";

interface UpdateOperationModalProps {
  t: Dictionary;
  open: boolean;
  activeOperation: TenantProvisioningOperationView | null;
  correlatedItems: readonly TenantAvailableUpdate[];
  operationErrorMessage: string | null;
  isCheckingOperation: boolean;
  onOpenChange: (open: boolean) => void;
  onRefreshOperation: () => void;
}

function resolveHeaderIconBox(surface: OperationSurfaceKind | null): string {
  switch (surface) {
    case "active":
      return SWATCH_SURFACE_PALETTES.blue.iconBoxIdle;
    case "waiting":
    case "cancelling":
    case "manualRecovery":
      return SWATCH_SURFACE_PALETTES.amber.iconBoxIdle;
    case "succeeded":
      return SWATCH_SURFACE_PALETTES.green.iconBoxIdle;
    case "failedRetryable":
      return SWATCH_SURFACE_PALETTES.red.iconBoxIdle;
    case "cancelled":
    default:
      return SWATCH_SURFACE_PALETTES.slate.iconBoxIdle;
  }
}

function renderStatusHeaderIcon(status: TenantOperationStatus | null) {
  if (!status) return <CircleAlert className="size-4" aria-hidden="true" />;
  const surface = classifyOperationSurface(status);
  if (surface === "active") {
    const spinning = status === "PLANNING" || status === "RUNNING";
    return <RefreshCw className={spinning ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />;
  }
  if (surface === "succeeded") return <ShieldCheck className="size-4" aria-hidden="true" />;
  if (surface === "waiting" || surface === "cancelling" || surface === "manualRecovery") {
    return <AlertTriangle className="size-4" aria-hidden="true" />;
  }
  return <CircleAlert className="size-4" aria-hidden="true" />;
}

export function UpdateOperationModal({
  t,
  open,
  activeOperation,
  correlatedItems,
  operationErrorMessage,
  isCheckingOperation,
  onOpenChange,
  onRefreshOperation,
}: UpdateOperationModalProps) {
  const updatesUi = t.coreSettings.updatesUi;
  const surface = activeOperation ? classifyOperationSurface(activeOperation.status) : null;
  const phaseLabel = activeOperation
    ? formatOperationPhaseLabel(activeOperation.currentPhase, t, activeOperation.status)
    : null;
  const showSucceededItems =
    activeOperation?.status === "SUCCEEDED" && correlatedItems.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" aria-busy={isCheckingOperation || undefined}>
        <DialogHeader>
          <div className="flex items-start gap-2.5 pe-10">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md border",
                resolveHeaderIconBox(surface),
              )}
            >
              {renderStatusHeaderIcon(activeOperation?.status ?? null)}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-base">{updatesUi.operationModalTitle}</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                {activeOperation
                  ? formatOperationGuidance(activeOperation.status, t)
                  : t.commercialOperation.loadFailed}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {activeOperation ? (
          <div className="flex flex-col gap-2.5 rounded-md border border-border bg-surface-subtle p-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-badge text-muted-foreground">{updatesUi.colStatus}</span>
                <div>
                  <Badge tone={operationTone(activeOperation.status)} size="sm">
                    {formatOperationStatusLabel(activeOperation.status, t)}
                  </Badge>
                </div>
              </div>

              {activeOperation.updatedAt ? (
                <div className="flex flex-col gap-1">
                  <span className="text-badge text-muted-foreground">
                    {updatesUi.operationLastUpdated}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    <DateTime value={activeOperation.updatedAt} />
                  </span>
                </div>
              ) : null}
            </div>

            {phaseLabel ? (
              <div className="rounded-sm border border-border bg-card px-2.5 py-1.5 text-xs text-foreground-secondary">
                {phaseLabel}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeOperation?.status === "MANUAL_RECOVERY_REQUIRED" ? (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="font-medium">{updatesUi.operationManualRecoveryBannerTitle}</span>
          </div>
        ) : null}

        {showSucceededItems ? (
          <div className="divide-y divide-line-divider max-h-48 overflow-y-auto rounded-md border border-border bg-surface-subtle">
            {correlatedItems.map((item) => (
              <div key={item.componentKey} className="flex flex-col gap-1 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <IdentifierText className="text-xs font-medium text-foreground">
                    {item.componentKey}
                  </IdentifierText>
                  <span className="text-badge text-muted-foreground">
                    {formatTemplate(updatesUi.ownerPrefix, {
                      app: formatOwnerAppLabel(item.ownerApp, t),
                    })}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {item.current.releaseVersion ? (
                    <IdentifierText className="text-xs text-foreground-secondary">
                      {item.current.releaseVersion}
                    </IdentifierText>
                  ) : (
                    <span>{t.detail.notRecorded}</span>
                  )}
                  <ArrowRight
                    className={cn("size-3 shrink-0 text-muted-foreground", mirrorInRtl)}
                    aria-hidden="true"
                  />
                  <IdentifierText className="text-xs font-medium text-primary">
                    {item.availableRelease.releaseVersion}
                  </IdentifierText>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {operationErrorMessage ? (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground"
          >
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{`${t.commercialOperation.loadFailed} — ${operationErrorMessage}`}</span>
            </div>
            {activeOperation ? (
              <p className="ps-5 text-badge opacity-90">{updatesUi.operationRetainedStatusHint}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.close}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onRefreshOperation}
            loading={isCheckingOperation}
            disabled={isCheckingOperation}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {updatesUi.operationRefresh}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
