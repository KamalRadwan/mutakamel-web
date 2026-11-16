"use client";

import { Button, Combobox, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { RemoteOptions } from "../../hooks/useCoreOptions";
import {
  isRemoteOptionsEmpty,
  isRemoteOptionsForbidden,
  isSoleEligibleOption,
  type OrganizationCascadeResult,
} from "../../hooks/useOrganizationCascade";
import type { OrgLevelConfig } from "../level-config";
import type { OrgFormValidations } from "../hooks/useOrganizationForm";
import type { OrgNodeFormValues } from "../organization-payloads";

export interface EditReadOnlyParents {
  companyLabel?: string;
  branchLabel?: string;
  departmentLabel?: string;
}

interface OrganizationCascadeFieldsProps {
  config: OrgLevelConfig;
  mode: "create" | "edit";
  values: OrgNodeFormValues;
  isSubmitting: boolean;
  cascade?: OrganizationCascadeResult;
  /** Fallback single-level picker when `OrganizationNodeForm` is rendered standalone in tests. */
  parentOptions?: RemoteOptions;
  onDirectParentChange?: (parentId: string) => void;
  missingUpstreamPermission?: boolean;
  parentValidation?: OrgFormValidations["parent"];
  editReadOnlyParents?: EditReadOnlyParents;
}

interface CascadeStepRowProps {
  label: string;
  value: string;
  remote: RemoteOptions;
  disabled: boolean;
  waitingHint?: string;
  error?: string;
  onSelect: (next: string | undefined) => void;
}

function CascadeStepRow({
  label,
  value,
  remote,
  disabled,
  waitingHint,
  error,
  onSelect,
}: CascadeStepRowProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;

  const hint = waitingHint
    ? waitingHint
    : isRemoteOptionsForbidden(remote)
      ? copy.errors.MISSING_REQUIRED_PERMISSIONS
      : remote.error
        ? copy.cascade.loadFailed
        : isSoleEligibleOption(remote)
          ? copy.cascade.singleOption
          : isRemoteOptionsEmpty(remote)
            ? copy.cascade.noOptions
            : undefined;

  return (
    <div className="flex flex-col gap-1">
      <Field label={label} hint={hint} error={error} required showLabel>
        <Combobox textSize="compact"
          value={value || undefined}
          selectedLabel={remote.labelFor(value)}
          onValueChange={onSelect}
          options={remote.options}
          onSearch={remote.search}
          loading={remote.isLoading}
          disabled={disabled}
          placeholder={waitingHint ?? copy.picker.placeholder}
          searchPlaceholder={copy.picker.searchPlaceholder}
          loadingLabel={copy.picker.loading}
          emptyLabel={copy.picker.empty}
        />
      </Field>
      {remote.error && !isRemoteOptionsForbidden(remote) && remote.retry ? (
        <Button variant="ghost" size="xs" onClick={remote.retry} className="self-start">
          {copy.cascade.retry}
        </Button>
      ) : null}
    </div>
  );
}

export function OrganizationCascadeFields({
  config,
  mode,
  values,
  isSubmitting,
  cascade,
  parentOptions,
  onDirectParentChange,
  missingUpstreamPermission = false,
  parentValidation,
  editReadOnlyParents,
}: OrganizationCascadeFieldsProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;

  if (!config.parent) return null;

  if (mode === "edit") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {config.ancestors.includes("companies") ? (
          <Field label={copy.levels.companies.parentLabel} showLabel readOnly>
            <Input
              size="sm"
              value={editReadOnlyParents?.companyLabel ?? copy.grants.nameUnavailable}
              readOnly
            />
          </Field>
        ) : null}
        {config.ancestors.includes("branches") ? (
          <Field label={copy.levels.branches.parentLabel} showLabel readOnly>
            <Input
              size="sm"
              value={editReadOnlyParents?.branchLabel ?? copy.grants.nameUnavailable}
              readOnly
            />
          </Field>
        ) : null}
        {config.ancestors.includes("departments") ? (
          <Field label={copy.levels.departments.parentLabel} showLabel readOnly>
            <Input
              size="sm"
              value={editReadOnlyParents?.departmentLabel ?? copy.grants.nameUnavailable}
              readOnly
            />
          </Field>
        ) : null}
      </div>
    );
  }

  if (!cascade && parentOptions) {
    return (
      <Field
        label={copy.levels[config.parent].parentLabel}
        error={parentValidation?.error}
        required
        showLabel
      >
        <Combobox textSize="compact"
          value={values.parentId || undefined}
          selectedLabel={parentOptions.labelFor(values.parentId)}
          onValueChange={(next) => {
            onDirectParentChange?.(next ?? "");
            parentValidation?.fieldProps.onBlur();
          }}
          options={parentOptions.options}
          onSearch={parentOptions.search}
          loading={parentOptions.isLoading}
          disabled={isSubmitting || missingUpstreamPermission}
          placeholder={copy.picker.placeholder}
          searchPlaceholder={copy.picker.searchPlaceholder}
          loadingLabel={copy.picker.loading}
          emptyLabel={copy.picker.empty}
        />
      </Field>
    );
  }

  if (!cascade) return null;

  const needsBranchStep = config.level === "departments" || config.level === "teams";
  const needsDepartmentStep = config.level === "teams";

  const companyDisabled =
    isSubmitting || missingUpstreamPermission || isRemoteOptionsForbidden(cascade.companies);
  const branchDisabled =
    companyDisabled || !values.companyId || isRemoteOptionsForbidden(cascade.branches);
  const departmentDisabled =
    branchDisabled || !values.branchId || isRemoteOptionsForbidden(cascade.departments);

  return (
    <div className="flex flex-col gap-4">
      {missingUpstreamPermission ? (
        <p
          role="alert"
          className="rounded-sm border border-warning/30 bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground"
        >
          {copy.errors.MISSING_REQUIRED_PERMISSIONS}
        </p>
      ) : null}

      <CascadeStepRow
        label={copy.cascade.company}
        value={values.companyId}
        remote={cascade.companies}
        disabled={companyDisabled}
        error={config.level === "branches" ? parentValidation?.error : undefined}
        onSelect={(next) => {
          cascade.selectCompany(next);
          if (config.level === "branches") parentValidation?.fieldProps.onBlur();
        }}
      />

      {needsBranchStep ? (
        <CascadeStepRow
          label={copy.cascade.branch}
          value={values.branchId}
          remote={cascade.branches}
          disabled={branchDisabled}
          waitingHint={values.companyId ? undefined : copy.cascade.chooseCompanyFirst}
          error={config.level === "departments" ? parentValidation?.error : undefined}
          onSelect={(next) => {
            cascade.selectBranch(next);
            if (config.level === "departments") parentValidation?.fieldProps.onBlur();
          }}
        />
      ) : null}

      {needsDepartmentStep ? (
        <CascadeStepRow
          label={copy.cascade.department}
          value={values.departmentId}
          remote={cascade.departments}
          disabled={departmentDisabled}
          waitingHint={values.branchId ? undefined : copy.cascade.chooseBranchFirst}
          error={config.level === "teams" ? parentValidation?.error : undefined}
          onSelect={(next) => {
            cascade.selectDepartment(next);
            if (config.level === "teams") parentValidation?.fieldProps.onBlur();
          }}
        />
      ) : null}
    </div>
  );
}
