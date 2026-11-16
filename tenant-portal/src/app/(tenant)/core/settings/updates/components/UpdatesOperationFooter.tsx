"use client";

import { CircleAlert, RefreshCw } from "lucide-react";
import { Badge, Button, CardFooter, DateTime } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import type { TenantProvisioningOperationView } from "../provisioning-updates-contract";
import {
  formatOperationGuidance,
  formatOperationStatusLabel,
  operationTone,
} from "../updates-labels";

interface UpdatesOperationFooterProps {
  t: Dictionary;
  activeOperation: TenantProvisioningOperationView | null;
  operationErrorMessage: string | null;
  isCheckingOperation: boolean;
  isOpenModalDisabled: boolean;
  onOpenOperationModal: () => void;
  onRefreshOperation: () => void;
}

export function UpdatesOperationFooter({
  t,
  activeOperation,
  operationErrorMessage,
  isCheckingOperation,
  isOpenModalDisabled,
  onOpenOperationModal,
  onRefreshOperation,
}: UpdatesOperationFooterProps) {
  const updatesUi = t.coreSettings.updatesUi;

  return (
    <CardFooter className="flex flex-col items-stretch gap-2 border-t border-line-divider bg-surface-subtle">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {activeOperation ? (
            <>
              <Badge tone={operationTone(activeOperation.status)} size="sm">
                {formatTemplate(updatesUi.operationStripLabel, {
                  status: formatOperationStatusLabel(activeOperation.status, t),
                })}
              </Badge>
              <span className="text-xs text-foreground-secondary">
                {formatOperationGuidance(activeOperation.status, t)}
              </span>
              {activeOperation.updatedAt ? (
                <span className="text-xs text-muted-foreground">
                  <DateTime value={activeOperation.updatedAt} />
                </span>
              ) : null}
            </>
          ) : (
            <Badge tone="caution" size="sm">
              {t.commercialOperation.loadFailed}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="xs"
            variant="ghost"
            onClick={onOpenOperationModal}
            disabled={isOpenModalDisabled}
          >
            {updatesUi.operationViewDetails}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={onRefreshOperation}
            disabled={isCheckingOperation}
          >
            <RefreshCw
              className={isCheckingOperation ? "size-3 animate-spin" : "size-3"}
              aria-hidden="true"
            />
            {updatesUi.operationRefresh}
          </Button>
        </div>
      </div>

      {operationErrorMessage ? (
        <div
          role="status"
          className="flex flex-wrap items-start gap-1.5 rounded-sm border border-border bg-warning-subtle px-2.5 py-1.5 text-xs text-warning-subtle-foreground"
        >
          <CircleAlert
            className="mt-0.5 size-3.5 shrink-0 text-warning-subtle-foreground"
            aria-hidden="true"
          />
          <span>{`${t.commercialOperation.loadFailed} — ${operationErrorMessage}`}</span>
          {activeOperation ? (
            <span className="text-badge opacity-90">{updatesUi.operationRetainedStatusHint}</span>
          ) : null}
        </div>
      ) : null}
    </CardFooter>
  );
}
