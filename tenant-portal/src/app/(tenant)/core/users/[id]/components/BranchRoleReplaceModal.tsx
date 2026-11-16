"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Field, FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { branchRoleAssignmentKey } from "../../../contracts/role-assignment-contract";
import type { BranchRoleGrant, useUserRoleGrants } from "../hooks/useUserRoleGrants";

interface BranchRoleReplaceModalProps {
  panel: ReturnType<typeof useUserRoleGrants>;
  draft: BranchRoleGrant[];
  isDirty: boolean;
  editingDisabled: boolean;
  canAddSelected: boolean;
  pairCombobox: React.ReactNode;
  onAddRow: () => void;
  onClose: () => void;
  describe: (grant: BranchRoleGrant) => { label: string; hint?: string };
  writeError?: string;
}

export function BranchRoleReplaceModal({
  panel,
  draft,
  isDirty,
  editingDisabled,
  canAddSelected,
  pairCombobox,
  onAddRow,
  onClose,
  describe,
  writeError,
}: BranchRoleReplaceModalProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="wide"
      title={copy.memberships.replaceTitle}
      description={copy.grants.branchReplaceDescription}
      isDirty={isDirty}
      isSubmitting={panel.isSubmitting}
      submitDisabled={editingDisabled}
      onSubmit={panel.reviewBranch}
      error={writeError}
      labels={{
        submit: copy.grants.review,
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
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{copy.grants.replaceHint}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <Field label={copy.grants.assignablePair} showLabel>
              {pairCombobox}
            </Field>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!canAddSelected || editingDisabled}
            onClick={onAddRow}
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.grants.addBranchRole}
          </Button>
        </div>
        {draft.length === 0 ? (
          <p className="rounded-sm border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            {copy.grants.branchEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 rounded-sm border border-border p-2.5">
            {draft.map((grant) => {
              const key = branchRoleAssignmentKey(grant);
              const described = describe(grant);
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-foreground">
                    {described.label} — {described.hint}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={editingDisabled}
                    onClick={() =>
                      panel.setBranchDraft(
                        draft.filter(
                          (entry) => branchRoleAssignmentKey(entry) !== key,
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
        )}
      </div>
    </FormModal>
  );
}
