"use client";

import { History, Lock, RefreshCw, RotateCcw, Save } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmActionModal,
  ErrorState,
  PageHeader,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { INTL_LOCALE } from "@/lib/format/locale";
import { formatTemplate } from "@/lib/format/template";
import { useCoreErrorText } from "../../hooks/useCoreErrorText";
import { WorkspaceCurrencySection } from "./components/WorkspaceCurrencySection";
import { WorkspaceRegionalSection } from "./components/WorkspaceLeftCards";
import { WorkspaceConflictDialog, WorkspaceHistoryModal } from "./components/WorkspaceModals";
import { WorkspaceNotReadyState } from "./components/WorkspaceNotReadyState";
import { WorkspaceSupportSection } from "./components/WorkspaceRightRail";
import { useTimezoneOptions } from "./hooks/useTimezoneOptions";
import { useWorkspaceHistory } from "./hooks/useWorkspaceAuditPreview";
import { useWorkspaceSettings } from "./hooks/useWorkspaceSettings";
import { describeWorkspaceLoadFailure } from "./workspace-errors";

export default function WorkspaceSettingsPage() {
  const describeError = useCoreErrorText();
  const {
    t,
    lang,
    canManage,
    canReadCurrencies,
    settings,
    draft,
    currencyOptions,
    currenciesTotal,
    isCurrenciesTruncated,
    isLoadingCurrencies,
    currencyLoadFailure,
    dirtyCount,
    conflict,
    isLoading,
    isSaving,
    isDirty,
    isLoadForbidden,
    isNotReady,
    loadFailure,
    fieldError,
    canSave,
    isDiscardOpen,
    confirmDiscard,
    onDiscardOpenChange,
    updateDraft,
    discardDraft,
    save,
    dismissConflict,
    reloadFromConflict,
    overwriteConflict,
    retryCurrencyOptions,
    reload,
  } = useWorkspaceSettings();

  const {
    canReadAudit,
    isHistoryOpen,
    openHistory,
    setHistoryOpen,
    historyValueLabels,
  } = useWorkspaceHistory(t, currencyOptions);

  const timezones = useTimezoneOptions(draft?.timezone ?? "", INTL_LOCALE[lang]);
  const isReadOnly = !canManage;
  const wsUi = t.coreSettings.workspaceUi;
  const loadFailureCopy = loadFailure
    ? describeWorkspaceLoadFailure(loadFailure, t, describeError)
    : null;

  return (
    <PermissionGate require="workspace.read" denied={!isLoading && isLoadForbidden}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <PageHeader
          className="sr-only"
          title={t.coreSettings.workspaceTitle}
          description={t.coreSettings.workspaceSubtitle}
          primaryAction={
            canManage && draft
              ? {
                  label:
                    isDirty && dirtyCount > 0
                      ? formatTemplate(wsUi.saveWithCount, { count: dirtyCount })
                      : t.coreSettings.save,
                  icon: <Save className="size-3.5" aria-hidden="true" />,
                  onClick: () => void save(),
                  disabled: !canSave || isSaving,
                  loading: isSaving,
                }
              : undefined
          }
          secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              {!canManage && draft ? (
                <Badge tone="neutral" size="sm">
                  <Lock className="size-3.5" aria-hidden="true" />
                  {t.common.readOnly}
                </Badge>
              ) : null}

              {canManage && isDirty ? (
                <Button size="sm" variant="ghost" onClick={discardDraft} disabled={isSaving}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  {wsUi.discard}
                </Button>
              ) : null}

              {canReadAudit && settings ? (
                <Button size="sm" variant="outline" onClick={openHistory}>
                  <History className="size-3.5" aria-hidden="true" />
                  {t.audit.historyTitle}
                </Button>
              ) : null}

              <Button
                size="sm"
                variant="outline"
                onClick={reload}
                disabled={isLoading || isSaving}
              >
                <RefreshCw
                  className={isLoading ? "size-3.5 animate-spin" : "size-3.5"}
                  aria-hidden="true"
                />
                {t.coreSettings.reload}
              </Button>
            </div>
          }
        />

        {isLoading && !draft ? <WorkspaceSkeleton /> : null}

        {!isLoading && isNotReady ? (
          <WorkspaceNotReadyState t={t} isLoading={isLoading} onReload={reload} />
        ) : null}

        {!isLoading && loadFailureCopy ? (
          <ErrorState
            title={loadFailureCopy.title}
            description={loadFailureCopy.description}
            onRetry={loadFailureCopy.retryable ? reload : undefined}
            retryLabel={t.common.retry}
          />
        ) : null}

        {draft ? (
          <>
            <WorkspaceRegionalSection
              t={t}
              lang={lang}
              draft={draft}
              isReadOnly={isReadOnly}
              isSaving={isSaving}
              fieldError={fieldError}
              timezones={timezones}
              onUpdateDraft={updateDraft}
            />

            <WorkspaceCurrencySection
              t={t}
              lang={lang}
              settings={settings}
              draft={draft}
              currencyOptions={currencyOptions}
              currenciesTotal={currenciesTotal}
              isCurrenciesTruncated={isCurrenciesTruncated}
              canReadCurrencies={canReadCurrencies}
              isLoadingCurrencies={isLoadingCurrencies}
              currencyLoadFailure={currencyLoadFailure}
              describeError={describeError}
              isReadOnly={isReadOnly}
              isSaving={isSaving}
              fieldError={fieldError}
              onRetryCurrencies={() => void retryCurrencyOptions()}
              onUpdateDraft={updateDraft}
            />

            <WorkspaceSupportSection
              t={t}
              draft={draft}
              isReadOnly={isReadOnly}
              isSaving={isSaving}
              onUpdateDraft={updateDraft}
            />
          </>
        ) : null}

        <ConfirmActionModal
          open={isDiscardOpen}
          onOpenChange={onDiscardOpenChange}
          title={t.common.discardTitle}
          description={t.common.discardDescription}
          confirmLabel={t.common.discardConfirm}
          cancelLabel={t.common.cancel}
          onConfirm={confirmDiscard}
          loading={isSaving}
        />

        <WorkspaceConflictDialog
          t={t}
          conflict={conflict}
          currencyOptions={currencyOptions}
          loading={isSaving}
          onCancel={dismissConflict}
          onReload={() => void reloadFromConflict()}
          onOverwrite={() => void overwriteConflict()}
        />

        {canReadAudit ? (
          <WorkspaceHistoryModal
            t={t}
            open={isHistoryOpen}
            onOpenChange={setHistoryOpen}
            settings={settings}
            valueLabels={historyValueLabels}
          />
        ) : null}
      </div>
    </PermissionGate>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <CardContent className="flex flex-col gap-3 py-5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
