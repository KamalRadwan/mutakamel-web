"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Combobox,
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
  type ScopeRoleTarget,
} from "../../../contracts/role-assignment-contract";
import type { RemoteOptions } from "../../../hooks/useCoreOptions";

interface ScopeRoleDraftEditorProps {
  draft: ScopeRoleAssignmentInput[];
  onDraftChange: (next: ScopeRoleAssignmentInput[]) => void;
  roles: RemoteOptions;
  companies: RemoteOptions;
  branches: RemoteOptions;
  describe: (assignment: ScopeRoleAssignmentInput) => { label: string; hint?: string };
  onReview: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

/**
 * The pre-write editor for the owner-only atomic replacement.
 *
 * Nothing here writes. It builds the complete set the `PUT` would send, so the
 * diff dialog can show what disappears before the transaction runs.
 */
export function ScopeRoleDraftEditor({
  draft,
  onDraftChange,
  roles,
  companies,
  branches,
  describe,
  onReview,
  onCancel,
  isSubmitting,
}: ScopeRoleDraftEditorProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const [scopeTarget, setScopeTarget] = useState<ScopeRoleTarget>("TENANT");
  const [roleId, setRoleId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");

  const pickerLabels = {
    placeholder: copy.picker.placeholder,
    searchPlaceholder: copy.picker.searchPlaceholder,
    loadingLabel: copy.picker.loading,
    emptyLabel: copy.picker.empty,
  };

  function addRow() {
    if (!roleId) return;
    const candidate: ScopeRoleAssignmentInput = {
      scopeTarget,
      roleId,
      companyId: scopeTarget === "COMPANY" ? companyId || undefined : undefined,
      branchId: scopeTarget === "BRANCH" ? branchId || undefined : undefined,
    };
    const key = scopeRoleAssignmentKey(candidate);
    if (draft.some((item) => scopeRoleAssignmentKey(item) === key)) return;
    onDraftChange([...draft, candidate]);
    setRoleId("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border bg-muted p-3">
      <p className="text-2xs text-muted-foreground">{copy.grants.replaceHint}</p>

      <ul className="flex flex-col gap-1">
        {draft.map((item) => {
          const key = scopeRoleAssignmentKey(item);
          const described = describe(item);
          return (
            <li key={key} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-foreground">
                {described.label} — {described.hint}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() =>
                  onDraftChange(draft.filter((entry) => scopeRoleAssignmentKey(entry) !== key))
                }
                aria-label={`${t.common.delete}: ${described.label}`}
              >
                <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <Select
          value={scopeTarget}
          onValueChange={(next) =>
            setScopeTarget(SCOPE_ROLE_TARGETS.find((target) => target === next) ?? "TENANT")
          }
        >
          <SelectTrigger className="w-40">
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

        <div className="min-w-44 flex-1">
          <Combobox
            {...pickerLabels}
            value={roleId || undefined}
            selectedLabel={roles.labelFor(roleId)}
            onValueChange={(next) => setRoleId(next ?? "")}
            options={roles.options}
            onSearch={roles.search}
            loading={roles.isLoading}
          />
        </div>

        {scopeTarget === "COMPANY" ? (
          <div className="min-w-44 flex-1">
            <Combobox
              {...pickerLabels}
              value={companyId || undefined}
              selectedLabel={companies.labelFor(companyId)}
              onValueChange={(next) => setCompanyId(next ?? "")}
              options={companies.options}
              onSearch={companies.search}
              loading={companies.isLoading}
            />
          </div>
        ) : null}

        {scopeTarget === "BRANCH" ? (
          <div className="min-w-44 flex-1">
            <Combobox
              {...pickerLabels}
              value={branchId || undefined}
              selectedLabel={branches.labelFor(branchId)}
              onValueChange={(next) => setBranchId(next ?? "")}
              options={branches.options}
              onSearch={branches.search}
              loading={branches.isLoading}
            />
          </div>
        ) : null}

        <Button variant="outline" size="sm" onClick={addRow} disabled={!roleId}>
          <Plus className="size-4" aria-hidden="true" />
          {copy.grants.addScopeRole}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReview} disabled={isSubmitting}>
          {copy.grants.review}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}
