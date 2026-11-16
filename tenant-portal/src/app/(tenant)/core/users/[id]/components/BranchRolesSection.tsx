"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  AtomicReplacementConfirm,
  Button,
  Combobox,
  ConfirmActionModal,
  DataTable,
  Field,
  FormModal,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { BranchRoleAssignment } from "../../../contracts/role-assignment-contract";
import type { useRoleGrantOptions } from "../../../hooks/useRoleGrantOptions";
import { useBranchRoleForm } from "../hooks/useBranchRoleForm";
import type { useUserRoleGrants } from "../hooks/useUserRoleGrants";
import { BranchRoleReplaceModal } from "./BranchRoleReplaceModal";
import { listTableLabels } from "./list-table-labels";

interface BranchRolesSectionProps {
  panel: ReturnType<typeof useUserRoleGrants>;
  grantOptions: ReturnType<typeof useRoleGrantOptions>;
  roleLabel: (id: string) => string;
  branchLabel: (id: string | null | undefined) => string;
  writeError?: string;
  optionsErrorText?: string;
}

/**
 * `tenant_user_branch_roles` — summary table on `/core/users/[id]` with centered
 * modals for granting one `(branch, role)` pair (`POST`) or replacing the whole
 * collection (`PUT`, preceded by `AtomicReplacementConfirm`).
 */
export function BranchRolesSection({
  panel,
  grantOptions,
  roleLabel,
  branchLabel,
  writeError,
  optionsErrorText,
}: BranchRolesSectionProps) {
  const { t } = useI18n();
  const lang = useLanguage();
  const copy = t.coreIdentity;
  const form = useBranchRoleForm({ panel, grantOptions });

  const describe = (grant: { branchId: string; roleId: string }) => ({
    label: roleLabel(grant.roleId),
    hint: branchLabel(grant.branchId),
  });

  const columns: ColumnDef<BranchRoleAssignment>[] = [
    {
      id: "role",
      header: copy.roles.singular,
      cell: (row) => roleLabel(row.roleId),
    },
    {
      id: "branch",
      header: copy.levels.branches.singular,
      cell: (row) => branchLabel(row.branchId),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => panel.requestRemoval(row)}
          disabled={form.editingDisabled}
          aria-label={`${t.common.delete}: ${roleLabel(row.roleId)}`}
        >
          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
        </Button>
      ),
    },
  ];

  const pairCombobox = (
    <Combobox textSize="compact"
      id="branch-role-pair"
      placeholder={copy.picker.placeholder}
      searchPlaceholder={copy.picker.searchPlaceholder}
      loadingLabel={copy.picker.loading}
      emptyLabel={copy.picker.empty}
      value={form.selectedPair || undefined}
      selectedLabel={
        form.selectedPair
          ? `${roleLabel(form.selectedRoleId)} — ${branchLabel(form.selectedBranchId)}`
          : undefined
      }
      onValueChange={(next) => form.setSelectedPair(next ?? "")}
      options={grantOptions.isReady ? grantOptions.options : []}
      onSearch={grantOptions.search}
      loading={grantOptions.isLoading}
      disabled={panel.isSubmitting}
      errorContent={grantOptions.error ? optionsErrorText ?? copy.grants.optionsLoadFailed : undefined}
      footer={
        grantOptions.hasMore && grantOptions.isReady ? (
          <Button variant="ghost" size="sm" onClick={grantOptions.loadMore}>
            {copy.grants.moreOptions}
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-xs font-medium text-foreground">
            {copy.grants.branchRolesTitle}
          </h3>
          <p className="text-2xs text-muted-foreground">
            {copy.grants.branchRolesDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={form.editingDisabled}
            onClick={form.openAdd}
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.grants.addBranchRole}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={form.startReplace}
            disabled={form.editingDisabled || panel.branchRoles.length === 0}
          >
            {copy.memberships.replaceAll}
          </Button>
        </div>
      </div>

      {grantOptions.error ? (
        <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
          <span>{optionsErrorText ?? copy.grants.optionsLoadFailed}</span>
          <Button variant="ghost" size="sm" onClick={grantOptions.retry}>
            {t.common.retry}
          </Button>
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={panel.branchRoles}
        isLoading={panel.isBranchLoading}
        error={panel.branchError}
        onRetry={panel.reload}
        rowKey={(row) => row.id}
        labels={listTableLabels(
          t,
          copy.grants.branchLoadFailed,
          copy.grants.branchEmpty,
        )}
      />

      {form.isAddOpen ? (
        <FormModal
          open={form.isAddOpen}
          onOpenChange={(open) => {
            if (!open) form.closeAdd();
          }}
          size="card"
          title={copy.grants.branchRolesTitle}
          description={copy.grants.branchRolesDescription}
          isDirty={form.selectedPair.length > 0}
          isSubmitting={panel.isSubmitting}
          submitDisabled={!form.selected || form.editingDisabled}
          onSubmit={() => void form.submitSingleAdd()}
          error={writeError}
          labels={{
            submit: copy.grants.addBranchRole,
            cancel: t.common.cancel,
            close: copy.actions.close,
            discardTitle: t.common.discardTitle,
            discardDescription: t.common.discardDescription,
            discardConfirm: t.common.discardConfirm,
            discardCancel: t.common.cancel,
            sections: t.common.general,
            sectionInvalid: copy.errors.UNKNOWN,
          }}
        >
          <Field label={copy.grants.assignablePair} showLabel required>
            {pairCombobox}
          </Field>
        </FormModal>
      ) : null}

      {form.draft !== null && !panel.isReviewingBranch ? (
        <BranchRoleReplaceModal
          panel={panel}
          draft={form.draft}
          isDirty={form.isDraftDirty}
          editingDisabled={form.editingDisabled}
          canAddSelected={Boolean(form.selected)}
          pairCombobox={pairCombobox}
          onAddRow={form.addDraftRow}
          onClose={form.closeReplace}
          describe={describe}
          writeError={writeError}
        />
      ) : null}

      <ConfirmActionModal
        open={panel.pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) panel.cancelRemoval();
        }}
        title={copy.grants.removeBranchRoleTitle}
        description={formatTemplate(copy.grants.removeBranchRoleMessage, {
          name: panel.pendingRemoval ? roleLabel(panel.pendingRemoval.roleId) : "",
        })}
        confirmLabel={copy.actions.delete}
        cancelLabel={t.common.cancel}
        onConfirm={() => {
          if (!form.editingDisabled) void panel.removeBranchRole();
        }}
        loading={panel.isSubmitting}
      />

      <AtomicReplacementConfirm
        open={panel.isReviewingBranch}
        onOpenChange={(open) => {
          if (!open) panel.closeBranchReview();
        }}
        diff={panel.branchDiff(describe)}
        onConfirm={() => {
          if (!form.editingDisabled) void panel.commitBranchRoles();
        }}
        loading={panel.isSubmitting}
        formatCount={(count) => formatNumber(count, lang)}
        labels={{
          title: copy.memberships.replaceTitle,
          description: copy.grants.branchReplaceDescription,
          addedHeading: t.atomicReplacement.addedHeading,
          removedHeading: t.atomicReplacement.removedHeading,
          unchangedHeading: t.atomicReplacement.unchangedHeading,
          noChanges: t.atomicReplacement.noChanges,
          confirm: t.atomicReplacement.confirm,
          cancel: t.common.cancel,
          acknowledge: t.atomicReplacement.acknowledge,
        }}
      />
    </section>
  );
}
