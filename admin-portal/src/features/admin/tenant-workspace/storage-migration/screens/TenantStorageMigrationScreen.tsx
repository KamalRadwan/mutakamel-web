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
import { storageMigrationCopy } from "../copy";
import { StorageMigrationFinishPanel } from "../components/StorageMigrationFinishPanel";
import { StorageMigrationMonitorPanel } from "../components/StorageMigrationMonitorPanel";
import { StorageMigrationSelectPanel } from "../components/StorageMigrationSelectPanel";
import { useTenantStorageMigrationWizard } from "../hooks/useTenantStorageMigrationWizard";
import { STORAGE_MIGRATION_READ_PERMISSION } from "../model/permissions";

/**
 * Moving one tenant's object storage to another Storage Server.
 *
 * Gated on the migration *read* permission: every phase is driven by reads, and
 * execute plus critical is checked separately on the submit so an operator who
 * can watch a migration but not start one still sees the ledger.
 */
export function TenantStorageMigrationScreen({ tenantId }: { tenantId: string }) {
  return (
    <PermissionGate permission={STORAGE_MIGRATION_READ_PERMISSION}>
      <TenantStorageMigrationWorkspace tenantId={tenantId} />
    </PermissionGate>
  );
}

function TenantStorageMigrationWorkspace({ tenantId }: { tenantId: string }) {
  const { dir } = useI18n();
  // The screen owns the region the poll must not disrupt; the hook only reads
  // it. Keeping the ref out of the controller keeps every panel's render free
  // of ref access.
  const formRef = useRef<HTMLDivElement>(null);
  const ownedRefreshRegionRefs = useMemo(() => [formRef], []);
  const controller = useTenantStorageMigrationWizard(tenantId, {
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
        <p
          role="status"
          className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground"
        >
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
        // honest way to clear it is to read what Core actually has.
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
              onClick={() =>
                void (controller.intentMismatch === "release"
                  ? controller.reconcileRelease()
                  : controller.reconcileStart())
              }
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
          retrying={controller.isStarting || controller.isReconciling}
          onRetryExact={() => void controller.startMigration()}
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

      {controller.phase !== "select" && controller.preflight?.openMigrationId ? (
        <div
          role="status"
          className="rounded-md border border-info/30 bg-info-subtle p-3 text-info-subtle-foreground"
        >
          <p className="text-sm font-medium">{copy.openMigrationTitle}</p>
          <p className="mt-1 text-xs leading-5">{copy.openMigrationDescription}</p>
        </div>
      ) : null}

      {controller.commandError && !controller.ambiguousCommand ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"
        >
          <p>{controller.commandError.message}</p>
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
        <StorageMigrationSelectPanel controller={controller} regionRef={formRef} />
      ) : null}
      {controller.phase === "monitor" ? (
        <StorageMigrationMonitorPanel controller={controller} />
      ) : null}
      {controller.phase === "finish" ? (
        <StorageMigrationFinishPanel controller={controller} />
      ) : null}

      <ConfirmActionModal
        isOpen={controller.confirmOpen}
        onClose={controller.closeConfirm}
        onConfirm={controller.startMigration}
        titleEn={storageMigrationCopy.en.confirmTitle}
        titleAr={storageMigrationCopy.ar.confirmTitle}
        descriptionEn={storageMigrationCopy.en.confirmDescription}
        descriptionAr={storageMigrationCopy.ar.confirmDescription}
        confirmTextEn={storageMigrationCopy.en.confirmAction}
        confirmTextAr={storageMigrationCopy.ar.confirmAction}
        variant="danger"
        requiredConfirmationText={tenantId}
        isLoading={controller.isStarting}
      />

      <ConfirmActionModal
        isOpen={controller.releaseConfirmOpen}
        onClose={controller.closeReleaseConfirm}
        onConfirm={controller.releaseSource}
        titleEn={storageMigrationCopy.en.releaseConfirmTitle}
        titleAr={storageMigrationCopy.ar.releaseConfirmTitle}
        descriptionEn={storageMigrationCopy.en.releaseConfirmDescription}
        descriptionAr={storageMigrationCopy.ar.releaseConfirmDescription}
        confirmTextEn={storageMigrationCopy.en.releaseConfirmAction}
        confirmTextAr={storageMigrationCopy.ar.releaseConfirmAction}
        variant="danger"
        requiredConfirmationText={tenantId}
        isLoading={controller.isReleasing}
      />
    </div>
  );
}
