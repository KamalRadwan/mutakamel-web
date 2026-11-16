"use client";

import {
  AlertCircle, Clock8, Lock, Pencil, RefreshCw, RotateCcw, Save, ShieldCheck,
} from "lucide-react";
import {
  Badge, Button, Card, ConfirmActionModal, EmptyState, ErrorState, PageHeader,
  PermissionGate, Skeleton,
} from "@/design-system";
import { useEmailConfig } from "../hooks/useEmailConfig";
import { EmailConflictDialog } from "./EmailConflictDialog";
import { EmailDnsPanel } from "./EmailDnsPanel";
import { EmailLimitsModal } from "./EmailLimitsModal";
import { EmailProviderModal } from "./EmailProviderModal";
import { EmailSenderModal } from "./EmailSenderModal";
import { EmailSmtpModal } from "./EmailSmtpModal";
import { EmailSmtpProbeModal } from "./EmailSmtpProbeModal";
import { EmailSummaryRows } from "./EmailSummaryRows";

interface EmailConfigWorkspaceProps {
  hasExternalOverlay?: boolean;
}

export function EmailConfigWorkspace({ hasExternalOverlay = false }: EmailConfigWorkspaceProps) {
  return (
    <PermissionGate require="workspace.email.read">
      <EmailConfigContent hasExternalOverlay={hasExternalOverlay} />
    </PermissionGate>
  );
}

function EmailConfigContent({ hasExternalOverlay }: Required<EmailConfigWorkspaceProps>) {
  const {
    t, canManage, config, draft, activeModal, isLoading, pending,
    probeOutcome, isDirty, isDiscardOpen,
    isNotReady, isAccessBlocked, isForbidden,
    hasLoadError, loadErrorMessage, fieldErrors, formError,
    conflict, conflictReview, isConflictLoading,
    openModal, closeModal, updateDraft,
    discardDraft, confirmDiscard, cancelDiscard,
    dismissConflict, resolveConflict,
    adoptConflictLatest, discardConflictDraft,
    setDeliveryStatus, save,
    verify, verifyConnection, reload,
  } = useEmailConfig();

  const isBusy = pending !== null || isLoading || isConflictLoading;
  const isReadOnly = !canManage;
  const hasOpenOverlay =
    hasExternalOverlay || activeModal !== null || conflict !== null || isDiscardOpen;

  return (
    <PermissionGate require="workspace.email.read" denied={isForbidden}>
      <div className="flex w-full flex-col gap-3">
        <PageHeader
          className="sr-only"
          title={t.coreSettings.emailTitle}
          primaryAction={
            canManage && config && draft && !hasOpenOverlay
              ? isDirty
                ? {
                    label: t.coreSettings.save,
                    icon: <Save className="size-3.5" aria-hidden="true" />,
                    onClick: () => void save(),
                    disabled: isBusy,
                    loading: pending === "save",
                  }
                : {
                    label: t.coreSettings.emailEditSettings,
                    icon: <Pencil className="size-3.5" aria-hidden="true" />,
                    onClick: () => openModal("sender"),
                    disabled: isBusy,
                  }
              : undefined
          }
          secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              {isReadOnly && config ? (
                <Badge tone="neutral" size="sm">
                  <Lock className="size-3.5" aria-hidden="true" />
                  {t.common.readOnly}
                </Badge>
              ) : null}

              {canManage && config && isDirty ? (
                <>
                  <Badge tone="caution" size="sm">
                    {t.coreSettings.emailUnsavedDraftBadge}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => openModal("sender")} disabled={isBusy}>
                    {t.coreSettings.emailEditSettings}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={discardDraft} disabled={isBusy}>
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    {t.coreSettings.workspaceUi.discard}
                  </Button>
                </>
              ) : null}

              <Button variant="outline" size="sm" onClick={reload} disabled={isBusy}>
                <RefreshCw className={isLoading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
                {t.coreSettings.reload}
              </Button>
            </div>
          }
        />

        {isLoading && !config ? <EmailConfigSkeleton /> : null}

        {!isLoading && isNotReady ? (
          <EmptyState
            icon={Clock8}
            title={t.coreSettings.emailNotReadyTitle}
            description={t.coreSettings.emailNotReadyDescription}
            action={{ label: t.coreSettings.reload, onClick: reload }}
          />
        ) : null}

        {!isLoading && isAccessBlocked ? (
          <EmptyState
            icon={ShieldCheck}
            title={t.coreSettings.emailTitle}
            description={t.coreSettings.emailAccessBlocked}
          />
        ) : null}

        {!isLoading && hasLoadError ? (
          <ErrorState
            title={t.coreSettings.emailLoadFailed}
            description={loadErrorMessage}
            onRetry={reload}
            retryLabel={t.common.retry}
          />
        ) : null}

        {formError && activeModal === null && conflict === null ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground wrap-anywhere"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <bdi>{formError}</bdi>
          </div>
        ) : null}

        {canManage && config && isDirty && activeModal === null ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {t.coreSettings.emailSaveBeforeVerifyHint}
          </p>
        ) : null}

        {config && draft ? (
          <>
            <EmailSummaryRows
              config={config}
              draft={draft}
              canManage={canManage}
              isDirty={isDirty}
              disabled={isBusy}
              pending={pending}
              onOpenModal={openModal}
              onVerify={() => void verify()}
              onSetDeliveryStatus={(nextStatus) => void setDeliveryStatus(nextStatus)}
              limitsAction={
                canManage ? (
                  <Button variant="outline" size="sm" onClick={() => openModal("limits")} disabled={isBusy}>
                    {t.coreSettings.emailEditLimitsAction}
                  </Button>
                ) : null
              }
            />
            <EmailSenderModal
              open={activeModal === "sender"}
              config={config}
              values={draft}
              fieldErrors={fieldErrors}
              formError={formError}
              isDirty={isDirty}
              isBusy={isBusy}
              isSubmitting={pending === "save"}
              readOnly={isReadOnly}
              onChange={updateDraft}
              onOpenSmtpSettings={() => openModal("smtp")}
              onSave={() => void save()}
              onClose={closeModal}
            />
            <EmailProviderModal
              open={activeModal === "provider"}
              config={config}
              values={draft}
              fieldErrors={fieldErrors}
              formError={formError}
              isDirty={isDirty}
              isBusy={isBusy}
              isSubmitting={pending === "save"}
              readOnly={isReadOnly}
              onChange={updateDraft}
              onOpenSmtpSettings={() => openModal("smtp")}
              onSave={() => void save()}
              onClose={closeModal}
            />
            <EmailSmtpModal
              open={activeModal === "smtp"}
              config={config}
              values={draft}
              fieldErrors={fieldErrors}
              formError={formError}
              isDirty={isDirty}
              isBusy={isBusy}
              pending={pending}
              readOnly={isReadOnly}
              onChange={updateDraft}
              onVerifyConnection={() => void verifyConnection()}
              onSave={() => void save()}
              onClose={closeModal}
            />
            <EmailSmtpProbeModal
              open={activeModal === "probe"}
              pending={pending}
              probeOutcome={probeOutcome}
              formError={formError}
              onRetry={() => void verifyConnection()}
              onBackToSmtp={() => openModal("smtp")}
              onClose={closeModal}
            />
            <EmailLimitsModal
              open={activeModal === "limits"}
              config={config}
              values={draft}
              fieldErrors={fieldErrors}
              formError={formError}
              isDirty={isDirty}
              isBusy={isBusy}
              isSubmitting={pending === "save"}
              readOnly={isReadOnly}
              onChange={updateDraft}
              onSave={() => void save()}
              onClose={closeModal}
            />
            <EmailDnsPanel
              open={activeModal === "dns"}
              config={config}
              values={draft}
              fieldErrors={fieldErrors}
              formError={formError}
              isDirty={isDirty}
              isBusy={isBusy}
              pending={pending}
              readOnly={isReadOnly}
              onChange={updateDraft}
              onSave={() => void save()}
              onVerify={() => void verify()}
              onClose={closeModal}
            />
          </>
        ) : null}

        <ConfirmActionModal
          open={isDiscardOpen}
          onOpenChange={(open) => { if (!open) cancelDiscard(); }}
          title={t.common.discardTitle}
          description={t.common.discardDescription}
          confirmLabel={t.common.discardConfirm}
          cancelLabel={t.common.cancel}
          onConfirm={confirmDiscard}
        />

        <EmailConflictDialog
          kind={conflict}
          review={conflictReview}
          draftStatus={draft?.status ?? null}
          error={formError}
          loading={isConflictLoading}
          onResolve={() => void resolveConflict()}
          onAdoptLatest={adoptConflictLatest}
          onDiscardToLatest={discardConflictDraft}
          onCancel={dismissConflict}
        />
      </div>
    </PermissionGate>
  );
}

function EmailConfigSkeleton() {
  return (
    <Card className="divide-y divide-border overflow-hidden">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </Card>
  );
}
