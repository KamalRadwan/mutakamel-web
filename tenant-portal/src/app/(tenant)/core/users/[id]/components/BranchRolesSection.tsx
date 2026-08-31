"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  AtomicReplacementConfirm,
  Button,
  Combobox,
  ConfirmActionModal,
  DataTable,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type {
  BranchRoleAssignment,
} from "../../../contracts/role-assignment-contract";
import type { RemoteOptions } from "../../../hooks/useCoreOptions";
import type { useUserRoleGrants } from "../hooks/useUserRoleGrants";
import { listTableLabels } from "./list-table-labels";

interface BranchRolesSectionProps {
  panel: ReturnType<typeof useUserRoleGrants>;
  roles: RemoteOptions;
  branches: RemoteOptions;
  roleLabel: (id: string) => string;
  branchLabel: (id: string | null | undefined) => string;
}

/**
 * `tenant_user_branch_roles` — a role scoped to one branch.
 *
 * Three write paths, and they are genuinely different operations rather than
 * one with options: `POST` adds a single grant, `DELETE` removes one, and `PUT`
 * replaces the whole set. The replacement gets the diff confirmation because
 * the request body says nothing about what it takes away.
 */
export function BranchRolesSection({
  panel,
  roles,
  branches,
  roleLabel,
  branchLabel,
}: BranchRolesSectionProps) {
  const { t } = useI18n();
  const lang = useLanguage();
  const copy = t.coreIdentity;
  const [newBranchId, setNewBranchId] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const draft = panel.branchDraft;

  const pickerLabels = {
    placeholder: copy.picker.placeholder,
    searchPlaceholder: copy.picker.searchPlaceholder,
    loadingLabel: copy.picker.loading,
    emptyLabel: copy.picker.empty,
  };

  const describe = (grant: { branchId: string; roleId: string }) => ({
    label: roleLabel(grant.roleId),
    hint: branchLabel(grant.branchId),
  });

  const columns: ColumnDef<BranchRoleAssignment>[] = [
    { id: "role", header: copy.roles.singular, cell: (row) => roleLabel(row.roleId) },
    { id: "branch", header: copy.levels.branches.singular, cell: (row) => branchLabel(row.branchId) },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => panel.requestRemoval(row)}
          aria-label={`${t.common.delete}: ${roleLabel(row.roleId)}`}
        >
          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
        </Button>
      ),
    },
  ];

  function addRow() {
    if (!newRoleId || !newBranchId) return;
    if (draft === null) {
      void panel.addBranchRole({ branchId: newBranchId, roleId: newRoleId });
    } else if (
      !draft.some((grant) => grant.branchId === newBranchId && grant.roleId === newRoleId)
    ) {
      panel.setBranchDraft([...draft, { branchId: newBranchId, roleId: newRoleId }]);
    }
    setNewRoleId("");
    setNewBranchId("");
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-foreground">{copy.grants.branchRolesTitle}</h3>
      <p className="text-2xs text-muted-foreground">{copy.grants.branchRolesDescription}</p>

      <DataTable
        columns={columns}
        rows={panel.branchRoles}
        isLoading={panel.isBranchLoading}
        error={panel.branchError}
        onRetry={panel.reload}
        rowKey={(row) => row.id}
        labels={listTableLabels(t, copy.grants.branchLoadFailed, copy.grants.branchEmpty)}
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Combobox
            {...pickerLabels}
            value={newRoleId || undefined}
            selectedLabel={roles.labelFor(newRoleId)}
            onValueChange={(next) => setNewRoleId(next ?? "")}
            options={roles.options}
            onSearch={roles.search}
            loading={roles.isLoading}
            disabled={panel.isSubmitting}
          />
        </div>
        <div className="min-w-48 flex-1">
          <Combobox
            {...pickerLabels}
            value={newBranchId || undefined}
            selectedLabel={branches.labelFor(newBranchId)}
            onValueChange={(next) => setNewBranchId(next ?? "")}
            options={branches.options}
            onSearch={branches.search}
            loading={branches.isLoading}
            disabled={panel.isSubmitting}
          />
        </div>
        <Button
          variant="outline"
          disabled={!newRoleId || !newBranchId || panel.isSubmitting}
          onClick={addRow}
        >
          <Plus className="size-4" aria-hidden="true" />
          {copy.grants.addBranchRole}
        </Button>
        {draft === null ? (
          <Button
            variant="ghost"
            onClick={panel.startBranchReplace}
            disabled={panel.isSubmitting || panel.branchRoles.length === 0}
          >
            {copy.memberships.replaceAll}
          </Button>
        ) : null}
      </div>

      {draft !== null ? (
        <div className="flex flex-col gap-2 rounded-sm border border-border bg-muted p-3">
          <p className="text-2xs text-muted-foreground">{copy.grants.replaceHint}</p>
          <ul className="flex flex-col gap-1">
            {draft.map((grant) => {
              const key = `${grant.branchId}:${grant.roleId}`;
              const described = describe(grant);
              return (
                <li key={key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground">
                    {described.label} — {described.hint}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      panel.setBranchDraft(
                        draft.filter(
                          (entry) => `${entry.branchId}:${entry.roleId}` !== key,
                        ),
                      )
                    }
                    aria-label={`${t.common.delete}: ${described.label}`}
                  >
                    <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={panel.reviewBranch}
              disabled={panel.isSubmitting}
            >
              {copy.grants.review}
            </Button>
            <Button variant="ghost" size="sm" onClick={panel.cancelBranchReplace}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
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
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        onConfirm={() => void panel.removeBranchRole()}
        loading={panel.isSubmitting}
      />

      <AtomicReplacementConfirm
        open={panel.isReviewingBranch}
        onOpenChange={(open) => {
          if (!open) panel.closeBranchReview();
        }}
        diff={panel.branchDiff(describe)}
        onConfirm={() => void panel.commitBranchRoles()}
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
