"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Combobox,
  Field,
  FormModal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  SCOPE_ROLE_TARGETS,
  scopeRoleAssignmentKey,
  type ScopeRoleAssignmentInput,
} from "../../../contracts/role-assignment-contract";
import type { RemoteOptions } from "../../../hooks/useCoreOptions";
import { useScopeRoleDraftForm } from "../hooks/useScopeRoleDraftForm";

interface ScopeRoleDraftEditorProps {
  draft: ScopeRoleAssignmentInput[];
  initialKeys: string[];
  onDraftChange: (next: ScopeRoleAssignmentInput[]) => void;
  roles: RemoteOptions;
  companies: RemoteOptions;
  branches: RemoteOptions;
  describe: (assignment: ScopeRoleAssignmentInput) => { label: string; hint?: string };
  onReview: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error?: string;
}

/**
 * Centered modal editor for owner-only exact-scope role grants
 * (`PUT /users/:userId/scope-role-assignments`), without side rails.
 */
export function ScopeRoleDraftEditor({
  draft,
  initialKeys,
  onDraftChange,
  roles,
  companies,
  branches,
  describe,
  onReview,
  onCancel,
  isSubmitting,
  error,
}: ScopeRoleDraftEditorProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const form = useScopeRoleDraftForm({ draft, initialKeys, onDraftChange });

  const pickerLabels = {
    placeholder: copy.picker.placeholder,
    searchPlaceholder: copy.picker.searchPlaceholder,
    loadingLabel: copy.picker.loading,
    emptyLabel: copy.picker.empty,
  };

  const companyOptions =
    form.cascade.companies.options.length > 0 ? form.cascade.companies : companies;
  const branchOptions = form.companyId ? form.cascade.branches : branches;

  const selectedRoleLabel = form.roleId
    ? (roles.labelFor(form.roleId) ??
      (roles.isLoading ? copy.picker.loading : copy.grants.nameUnavailable))
    : undefined;
  const selectedCompanyLabel = form.companyId
    ? (form.cascade.companies.labelFor(form.companyId) ??
      companies.labelFor(form.companyId) ??
      (companyOptions.isLoading ? copy.picker.loading : copy.grants.nameUnavailable))
    : undefined;
  const selectedBranchLabel = form.branchId
    ? (form.cascade.branches.labelFor(form.branchId) ??
      branches.labelFor(form.branchId) ??
      (branchOptions.isLoading ? copy.picker.loading : copy.grants.nameUnavailable))
    : undefined;

  return (
    <FormModal
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      size="wide"
      title={copy.grants.editScopeRoles}
      description={copy.grants.scopeRolesDescription}
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      onSubmit={onReview}
      error={error}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={copy.grants.scope} showLabel required>
            <Select
              value={form.scopeTarget}
              onValueChange={form.handleScopeTargetChange}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_ROLE_TARGETS.map((target) => (
                  <SelectItem key={target} value={target}>
                    {copy.scopeTarget[target]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={copy.roles.singular} showLabel required>
            <Combobox
              {...pickerLabels}
              value={form.roleId || undefined}
              selectedLabel={selectedRoleLabel}
              onValueChange={(next) => form.setRoleId(next ?? "")}
              options={roles.options}
              onSearch={roles.search}
              loading={roles.isLoading}
              disabled={isSubmitting}
            />
          </Field>

          {form.scopeTarget === "COMPANY" || form.scopeTarget === "BRANCH" ? (
            <Field label={copy.levels.companies.singular} showLabel required>
              <Combobox textSize="compact"
                {...pickerLabels}
                value={form.companyId || undefined}
                selectedLabel={selectedCompanyLabel}
                onValueChange={form.cascade.selectCompany}
                options={companyOptions.options}
                onSearch={companyOptions.search}
                loading={companyOptions.isLoading}
                disabled={isSubmitting}
              />
            </Field>
          ) : null}

          {form.scopeTarget === "BRANCH" ? (
            <Field
              label={copy.levels.branches.singular}
              hint={!form.companyId ? copy.cascade.chooseCompanyFirst : undefined}
              showLabel
              required
            >
              <Combobox textSize="compact"
                {...pickerLabels}
                value={form.branchId || undefined}
                selectedLabel={selectedBranchLabel}
                onValueChange={form.cascade.selectBranch}
                options={branchOptions.options}
                onSearch={branchOptions.search}
                loading={branchOptions.isLoading}
                disabled={isSubmitting || !form.companyId}
              />
            </Field>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={form.addRow}
            disabled={!form.canAdd || isSubmitting}
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy.grants.addScopeRole}
          </Button>
        </div>

        {draft.length === 0 ? (
          <p className="rounded-sm border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            {copy.grants.scopeEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 rounded-sm border border-border p-2.5">
            {draft.map((item) => {
              const key = scopeRoleAssignmentKey(item);
              const described = describe(item);
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
                    disabled={isSubmitting}
                    onClick={() => form.removeRow(key)}
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
