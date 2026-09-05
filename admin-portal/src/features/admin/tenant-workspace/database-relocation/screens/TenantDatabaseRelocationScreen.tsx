"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import {
  AmbiguousOutcomePanel,
  Button,
  ConfirmActionModal,
  ErrorState,
  PageHeader,
  PermissionGate,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { relocationCopy } from "../copy";
import { RelocationFinishPanel } from "../components/RelocationFinishPanel";
import { RelocationMonitorPanel } from "../components/RelocationMonitorPanel";
import { RelocationSelectPanel } from "../components/RelocationSelectPanel";
import { useTenantDatabaseRelocation } from "../hooks/useTenantDatabaseRelocation";
import { TENANT_RELOCATION_READ_PERMISSION } from "../model/permissions";

/**
 * Moving one tenant's database to another Database Server.
 *
 * The page is gated on the relocation *read* permission because every phase —
 * including the destination list — comes from reads. Execute plus critical is
 * checked separately on the submit, so an operator who can watch a move but not
 * start one gets the ledger rather than a blank page.
 */
export function TenantDatabaseRelocationScreen({ tenantId }: { tenantId: string }) {
  return (
    <PermissionGate permission={TENANT_RELOCATION_READ_PERMISSION}>
      <TenantDatabaseRelocationWorkspace tenantId={tenantId} />
    </PermissionGate>
  );
}

function TenantDatabaseRelocationWorkspace({ tenantId }: { tenantId: string }) {
  const { dir } = useI18n();
  // The screen owns the region the poll must not disrupt; the hook only reads
  // it. Keeping the ref out of the controller keeps every panel's render free
  // of ref access.
  const formRef = useRef<HTMLDivElement>(null);
  const ownedRefreshRegionRefs = useMemo(() => [formRef], []);
  const controller = useTenantDatabaseRelocation(tenantId, {
    ownedRefreshRegionRefs,
  });
  const { copy } = controller;

  return (
    <div dir={dir} className="mx-auto max-w-[1200px] space-y-4">
      <Button asChild variant="link" className="px-0">
        <Link href={`/tenants/${tenantId}`}>
          {dir === "rtl" ? (
            <ArrowRight size={16} aria-hidden="true" />
          ) : (
            <ArrowLeft size={16} aria-hidden="true" />
          )}
          {copy.back}
        </Link>
      </Button>

      <PageHeader
        title={copy.pageTitle}
        description={copy.pageDescription}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void controller.refresh()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {copy.refresh}
          </Button>
        }
      />

      {controller.resourceState === "loading" ? (
        <p role="status" className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {copy.loading}
        </p>
      ) : null}

      {controller.resourceState === "error" ? (
        <ErrorState
          title={copy.preflightFailed}
          error={controller.loadError}
          onRetry={() => void controller.refresh()}
        />
      ) : null}

      {controller.intentMismatch ? (
        // Actionable, because the operator cannot resolve this any other way:
        // the stale attempt lives in their own session storage, and the only
        // honest way to clear it is to read what the Worker actually has.
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-subtle-foreground"
        >
          <p>{copy.pendingIntentChanged}</p>
          <div>
            <Button
              variant="outline"
              size="sm"
              loading={controller.isReconciling}
              onClick={() => void controller.reconcileStart()}
            >
              {copy.pendingIntentResolve}
            </Button>
          </div>
        </div>
      ) : null}

      {controller.ambiguousCommand === "start" ? (
        <AmbiguousOutcomePanel
          message={copy.ambiguousStart}
          idempotencyKey={controller.startAttempt?.idempotencyKey}
          correlationId={controller.commandError?.correlationId}
          retrying={controller.isReconciling}
          onReconcile={() => void controller.reconcileStart()}
        />
      ) : null}

      {controller.ambiguousCommand === "release" ? (
        <AmbiguousOutcomePanel
          message={copy.ambiguousRelease}
          idempotencyKey={controller.releaseAttempt?.idempotencyKey}
          correlationId={controller.commandError?.correlationId}
          retrying={controller.isReleasing || controller.isReconciling}
          onRetryExact={() => void controller.releaseSource()}
          onReconcile={() => void controller.reconcileRelease()}
        />
      ) : null}

      {controller.commandError && !controller.ambiguousCommand ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"
        >
          <p>
            {controller.commandError.errorCode ===
            "WORKER.BACKUP.RUNTIME_UNAVAILABLE"
              ? // The raw code reads like a fault. It is a deliberate refusal
                // with a specific cause and a specific remedy, and saying so
                // saves an operator from retrying a command that cannot run.
                copy.backupRuntimeUnavailable
              : controller.commandError.message}
          </p>
          <p className="mt-1 font-mono text-xs">
            <bdi dir="ltr">
              {controller.commandError.errorCode}
              {controller.commandError.correlationId
                ? ` · ${copy.correlation}: ${controller.commandError.correlationId}`
                : ""}
            </bdi>
          </p>
        </div>
      ) : null}

      {controller.resourceState === "ready" && controller.phase === "select" ? (
        <RelocationSelectPanel controller={controller} regionRef={formRef} />
      ) : null}
      {controller.phase === "monitor" ? (
        <RelocationMonitorPanel controller={controller} />
      ) : null}
      {controller.phase === "finish" ? (
        <RelocationFinishPanel controller={controller} />
      ) : null}

      <ConfirmActionModal
        isOpen={controller.confirmOpen}
        onClose={controller.closeConfirm}
        onConfirm={controller.startRelocation}
        titleEn={relocationCopy.en.confirmTitle}
        titleAr={relocationCopy.ar.confirmTitle}
        descriptionEn={relocationCopy.en.confirmDescription}
        descriptionAr={relocationCopy.ar.confirmDescription}
        confirmTextEn={relocationCopy.en.confirmAction}
        confirmTextAr={relocationCopy.ar.confirmAction}
        variant="warning"
        requiredConfirmationText={tenantId}
        isLoading={controller.isStarting}
      />

      <ConfirmActionModal
        isOpen={controller.releaseConfirmOpen}
        onClose={controller.closeReleaseConfirm}
        onConfirm={controller.releaseSource}
        titleEn={relocationCopy.en.releaseConfirmTitle}
        titleAr={relocationCopy.ar.releaseConfirmTitle}
        descriptionEn={relocationCopy.en.releaseConfirmDescription}
        descriptionAr={relocationCopy.ar.releaseConfirmDescription}
        confirmTextEn={relocationCopy.en.releaseConfirmAction}
        confirmTextAr={relocationCopy.ar.releaseConfirmAction}
        variant="danger"
        requiredConfirmationText={tenantId}
        isLoading={controller.isReleasing}
      />
    </div>
  );
}
