"use client";

import { ShieldCheck } from "lucide-react";
import {
  Button,
  ConfirmActionModal,
  FormModal,
  Stepper,
} from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { formatNumber } from "@/lib/format/number";
import type { RoleBranchPermissionsDocument } from "../contracts/role-branch-contract";
import { GLOBAL_VIEW_BRANCH_ID } from "../hooks/useRoleBranchDraftState";
import { useRoleBranchPermissionsModal } from "../hooks/useRoleBranchPermissionsModal";
import { useRoleBranchModalScopeKey } from "../hooks/useRoleBranchModalScopeKey";
import {
  RoleBranchOutcomeDialog,
  RoleBranchRemoveProfileDialog,
} from "./RoleBranchDialogs";
import { RoleBranchReviewStep } from "./RoleBranchReviewStep";
import { RoleBranchScopeStep } from "./RoleBranchScopeStep";
import { RoleBranchTreeStep } from "./RoleBranchTreeStep";

interface RoleBranchPermissionsModalProps {
  open: boolean;
  roleId: string | null;
  roleDisplayName: string;
  isSystemHint?: boolean;
  initialMode: "edit" | "view";
  onClose: () => void;
  onSaved: (doc: RoleBranchPermissionsDocument, receiptLines: string[]) => void;
}

export function RoleBranchPermissionsModal(props: RoleBranchPermissionsModalProps) {
  const scopeKey = useRoleBranchModalScopeKey(props.roleId, props.open);
  return <RoleBranchPermissionsContent key={scopeKey} {...props} />;
}

function RoleBranchPermissionsContent({
  open,
  roleId,
  roleDisplayName,
  isSystemHint = false,
  initialMode,
  onClose,
  onSaved,
}: RoleBranchPermissionsModalProps) {
  const wizard = useRoleBranchPermissionsModal({
    open,
    roleId,
    roleDisplayName,
    isSystemHint,
    initialMode,
    onSaved,
  });

  const { t, lang } = wizard;
  const copy = t.coreIdentity.roleBranch;
  const footerCopy = copy.footer;
  const discardCopy = copy.dialogs.discard;
  const clearAllCopy = copy.dialogs.clearAllProfiles;
  const readOnly = wizard.effectiveMode === "view";

  return (
    <>
      <FormModal
        key="role-branch-editor-surface"
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        size="permissions"
        headerIcon={
          <span className="flex size-10 items-center justify-center rounded-md border border-primary/20 bg-primary/5 text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
        }
        title={readOnly ? copy.viewAction : copy.assignAction}
        description={formatTemplate(
          wizard.isSystem ? copy.systemRoleSubtitle : copy.customRoleSubtitle,
          { name: wizard.roleName },
        )}
        isDirty={wizard.isDirty}
        isSubmitting={wizard.isSubmitting}
        submitDisabled={wizard.submitDisabled}
        hideSubmit={readOnly}
        onSubmit={wizard.handlePrimarySubmit}
        error={wizard.step === "review" ? wizard.writeErrorText : undefined}
        footerLeading={
          <div className="flex flex-wrap items-center gap-3">
            {wizard.step !== "scope" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={wizard.handleBack}
                disabled={wizard.isSubmitting}
              >
                {footerCopy.back}
              </Button>
            ) : null}
            {wizard.isDirty ? (
              <span className="text-xs text-muted-foreground">{footerCopy.unsavedDraft}</span>
            ) : null}
          </div>
        }
        labels={{
          submit: wizard.submitLabel,
          cancel: readOnly ? footerCopy.close : footerCopy.cancel,
          discardTitle: discardCopy.title,
          discardDescription: wizard.discardDescription,
          discardConfirm: discardCopy.confirm,
          discardCancel: discardCopy.keepEditing,
          sections: copy.stepperLabel,
          sectionInvalid: t.coreIdentity.errors.VALIDATION_FAILED,
          close: footerCopy.close,
        }}
      >
        <div className="min-w-0 border-b border-border pb-3">
          <Stepper
            steps={wizard.steps}
            label={copy.stepperLabel}
            onStepSelect={wizard.isLoading ? undefined : wizard.handleStepSelect}
          />
        </div>

        {wizard.unavailableSelectionCount > 0 ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
            <span>{formatTemplate(copy.permissions.unavailableSelections, {
              count: formatNumber(wizard.unavailableSelectionCount, lang),
            })}</span>
            <Button type="button" variant="outline" size="sm" onClick={wizard.removeUnavailableSelections} disabled={wizard.isSubmitting}>
              {copy.permissions.removeUnavailableSelections}
            </Button>
          </div>
        ) : null}
        {wizard.step === "scope" ? (
          <RoleBranchScopeStep
            t={t}
            lang={lang}
            readOnly={readOnly}
            companies={wizard.companies}
            branches={wizard.branches}
            selectedCompanyIds={wizard.selectedCompanyIds}
            onCompanySelectionChange={wizard.handleCompanySelectionChange}
            draftProfiles={wizard.draftProfiles}
            draftBranchIds={wizard.draftBranchIds}
            onToggleBranch={wizard.handleToggleBranch}
            autoSingleCompany={wizard.autoSingleCompany}
            autoSingleBranchId={wizard.autoSingleBranchId}
            showScopeValidation={wizard.showScopeValidation}
            isClearingAllSaved={wizard.isClearingAllSaved}
            hasInactiveSelection={wizard.hasInactiveSelection}
            maxBranches={wizard.maxBranches}
          />
        ) : wizard.step === "permissions" ? (
          <RoleBranchTreeStep
            t={t}
            lang={lang}
            readOnly={readOnly}
            isLoading={wizard.isLoading}
            showGlobalOption={
              readOnly &&
              wizard.document?.permissionMode === "GLOBAL" &&
              wizard.document.profiles.length === 0
            }
            branches={wizard.branches}
            selectedCompanyIds={wizard.selectedCompanyIds}
            draftProfiles={wizard.draftProfiles}
            activeBranchId={
              wizard.activeBranchId ||
              (readOnly && wizard.document?.permissionMode === "GLOBAL"
                ? GLOBAL_VIEW_BRANCH_ID
                : "")
            }
            onSelectBranch={wizard.setActiveBranchId}
            isActiveBranchIncluded={wizard.isActiveBranchIncluded}
            activePermissionIds={wizard.activePermissionIds}
            activeSelectedSet={wizard.activeSelectedSet}
            activeBranchMode={wizard.activeBranchMode}
            maxPerBranch={wizard.maxPerBranch}
            filteredModules={wizard.filteredModules}
            tenantLockedItems={wizard.taxonomy.tenantLockedItems}
            showWorkspaceLocked={wizard.showWorkspaceLocked}
            onToggleWorkspaceLocked={wizard.toggleWorkspaceLocked}
            searchQuery={wizard.searchQuery}
            onSearchChange={wizard.setSearchQuery}
            onClearSearch={wizard.clearSearch}
            filterMode={wizard.filterMode}
            onFilterModeChange={wizard.setFilterMode}
            onToggleActionRow={wizard.toggleActionRow}
            onChangeRecordScope={wizard.changeRecordScope}
            onToggleCollection={wizard.toggleCollection}
            onEditSelectedBranches={() => wizard.handleStepSelect("scope")}
          />
        ) : (
          <RoleBranchReviewStep
            t={t}
            lang={lang}
            readOnly={readOnly}
            document={wizard.document}
            items={wizard.reviewState.items}
            isClearingAllSaved={wizard.isClearingAllSaved}
            statusBanner={wizard.statusBanner}
            onAdoptServerVersion={wizard.adoptServerVersion}
          />
        )}
      </FormModal>

      <RoleBranchRemoveProfileDialog
        key="role-branch-remove-profile"
        open={wizard.pendingRemoval !== null}
        branchLabel={wizard.pendingRemoval?.branchLabel ?? ""}
        roleName={wizard.roleName}
        t={t}
        onConfirm={wizard.confirmRemoval}
        onCancel={wizard.cancelRemoval}
      />

      <ConfirmActionModal
        key="role-branch-clear-all"
        open={wizard.confirmClearAllOpen}
        onOpenChange={wizard.setConfirmClearAllOpen}
        title={clearAllCopy.title}
        description={formatTemplate(clearAllCopy.description, { role: wizard.roleName })}
        confirmLabel={clearAllCopy.confirm}
        cancelLabel={clearAllCopy.cancel}
        onConfirm={wizard.confirmClearAllSave}
        loading={wizard.isSubmitting}
      />

      <RoleBranchOutcomeDialog
        key="role-branch-outcome"
        kind={wizard.outcomeDialog}
        errorText={wizard.outcomeErrorText}
        correlationId={wizard.outcomeError?.correlationId}
        loading={wizard.isReconciling}
        t={t}
        onRetryRead={wizard.retryLoad}
        onCheckAuthority={wizard.recheckAuthority}
        onRefreshCatalogue={wizard.refreshCatalogue}
        onReviewLatest={wizard.reviewLatestVersion}
        onCheckUncertain={wizard.checkCurrentState}
        onClose={() => {
          const wasReadErrorWithoutDoc =
            wizard.outcomeDialog === "read-error" && wizard.document === null;
          wizard.setOutcomeDialog(null);
          if (wasReadErrorWithoutDoc) onClose();
        }}
      />
    </>
  );
}
