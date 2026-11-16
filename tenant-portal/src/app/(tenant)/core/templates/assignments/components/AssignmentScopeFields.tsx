"use client";

import { Field, NameSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { TemplateScopeType } from "../../templates-contract";
import type { useAssignmentScope } from "../hooks/useAssignmentScope";

export function AssignmentScopeFields({ selection }: { selection: ReturnType<typeof useAssignmentScope> }) {
  const { t, dir } = useI18n();
  const copy = t.coreOperations.templates;
  const labels = t.coreIdentity.cascade;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label={t.coreIdentity.grants.scope} showLabel>
        <Select dir={dir} value={selection.type} onValueChange={(value) => selection.selectType(value as TemplateScopeType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {selection.types.map((type) => <SelectItem key={type} value={type}>{copy.scopeTypes[type]}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {selection.type && selection.type !== "TENANT" ? (
        <Field label={labels.company} showLabel required>
          <NameSelect value={selection.selectedCompany} options={selection.companyOptions}
            onValueChange={selection.selectCompany} placeholder={t.coreIdentity.picker.placeholder} />
        </Field>
      ) : null}
      {selection.type === "BRANCH" ? (
        <Field label={labels.branch} showLabel required>
          <NameSelect value={selection.selectedBranch} options={selection.branchOptions}
            onValueChange={selection.selectBranch} placeholder={t.common.selectBranch}
            disabled={!selection.selectedCompany} />
        </Field>
      ) : null}
    </div>
  );
}
