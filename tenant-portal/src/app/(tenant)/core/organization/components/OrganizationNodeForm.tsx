"use client";

import {
  Combobox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ORG_ADDRESS_MAX_LENGTH,
  ORG_LEGAL_NAME_MAX_LENGTH,
  ORG_NODE_STATUSES,
  ORG_PHONE_MAX_LENGTH,
  ORG_TAX_NUMBER_MAX_LENGTH,
} from "../../contracts/organization-contract";
import type { RemoteOptions } from "../../hooks/useCoreOptions";
import type { OrganizationCascadeResult } from "../../hooks/useOrganizationCascade";
import type { OrgFormValidations } from "../hooks/useOrganizationForm";
import type { OrgLevelConfig } from "../level-config";
import { hasSavedCompanyCurrency, type OrgNodeFormValues } from "../organization-payloads";
import { OrganizationCascadeFields, type EditReadOnlyParents } from "./OrganizationCascadeFields";
import { OrganizationIdentityFields } from "./OrganizationIdentityFields";

interface OrganizationNodeFormProps {
  config: OrgLevelConfig;
  values: OrgNodeFormValues;
  onChange: (patch: Partial<OrgNodeFormValues>) => void;
  /** Create sends `code` and the direct parent id; update sends neither, plus `status`. */
  mode: "create" | "edit";
  isSubmitting: boolean;
  hasSavedCurrency?: boolean;
  cascade?: OrganizationCascadeResult;
  parentOptions?: RemoteOptions;
  leadUserOptions: RemoteOptions;
  canReadUsers?: boolean;
  selectedLeadLabel?: string;
  missingUpstreamPermission?: boolean;
  validations?: OrgFormValidations;
  editReadOnlyParents?: EditReadOnlyParents;
}

export function OrganizationNodeForm({
  config,
  values,
  onChange,
  mode,
  isSubmitting,
  hasSavedCurrency,
  cascade,
  parentOptions,
  leadUserOptions,
  canReadUsers = true,
  selectedLeadLabel,
  missingUpstreamPermission = false,
  validations,
  editReadOnlyParents,
}: OrganizationNodeFormProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const currencyRequired =
    mode === "edit" && (hasSavedCurrency ?? hasSavedCompanyCurrency(values.currencyCode));

  return (
    <div className="flex flex-col gap-4">
      <OrganizationCascadeFields
        config={config}
        mode={mode}
        values={values}
        isSubmitting={isSubmitting}
        cascade={cascade}
        parentOptions={parentOptions}
        onDirectParentChange={(parentId) => onChange({ parentId })}
        missingUpstreamPermission={missingUpstreamPermission}
        parentValidation={validations?.parent}
        editReadOnlyParents={editReadOnlyParents}
      />

      <OrganizationIdentityFields config={config} values={values} onChange={onChange} mode={mode}
        isSubmitting={isSubmitting} currencyRequired={currencyRequired} validations={validations} />

      {config.fields.includes("legalName") ? (
        <Field label={copy.fields.legalName} error={validations?.legalName.error} showLabel>
          <Input
            size="sm"
            placeholder={copy.fields.legalName}
            value={values.legalName}
            onChange={(event) => onChange({ legalName: event.target.value })}
            onBlur={validations?.legalName.fieldProps.onBlur}
            maxLength={ORG_LEGAL_NAME_MAX_LENGTH}
            disabled={isSubmitting}
          />
        </Field>
      ) : null}

      {config.fields.includes("taxNumber") ? (
        <Field label={copy.fields.taxNumber} error={validations?.taxNumber.error} showLabel>
          <Input size="sm" placeholder={copy.fields.taxNumber} dir="ltr" value={values.taxNumber}
            onChange={event => onChange({ taxNumber: event.target.value })}
            onBlur={validations?.taxNumber.fieldProps.onBlur} maxLength={ORG_TAX_NUMBER_MAX_LENGTH}
            disabled={isSubmitting} />
        </Field>
      ) : null}

      {config.fields.includes("phone") ? (
        <Field label={copy.fields.phone} error={validations?.phone.error} showLabel>
          <Input
            size="sm"
            placeholder={copy.fields.phone}
            dir="ltr"
            value={values.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            onBlur={validations?.phone.fieldProps.onBlur}
            maxLength={ORG_PHONE_MAX_LENGTH}
            disabled={isSubmitting}
          />
        </Field>
      ) : null}

      {config.fields.includes("address") ? (
        <Field label={copy.fields.address} error={validations?.address.error} showLabel>
          <Textarea
            placeholder={copy.fields.address}
            value={values.address}
            onChange={(event) => onChange({ address: event.target.value })}
            onBlur={validations?.address.fieldProps.onBlur}
            maxLength={ORG_ADDRESS_MAX_LENGTH}
            disabled={isSubmitting}
            rows={3}
          />
        </Field>
      ) : null}

      {config.fields.includes("isHeadquarters") ? (
        <div className="flex items-start justify-between gap-3 rounded-sm border border-border p-3">
          <div>
            <p className="text-xs font-medium text-foreground">{copy.fields.isHeadquarters}</p>
            <p className="text-2xs text-muted-foreground">{copy.fields.isHeadquartersHint}</p>
          </div>
          <Switch
            checked={values.isHeadquarters}
            onCheckedChange={(checked) => onChange({ isHeadquarters: checked })}
            disabled={isSubmitting}
            aria-label={copy.fields.isHeadquarters}
          />
        </div>
      ) : null}

      {config.fields.includes("leadUserId") ? (
        <Field
          label={copy.fields.leadUser}
          hint={!canReadUsers ? t.crmLeadDetail.usersPermissionRequired : undefined}
          error={validations?.leadUser.error}
          showLabel
        >
          <Combobox
            value={values.leadUserId || undefined}
            selectedLabel={leadUserOptions.labelFor(values.leadUserId) ?? selectedLeadLabel}
            onValueChange={(next) => {
              onChange({ leadUserId: next ?? "" });
              validations?.leadUser.fieldProps.onBlur();
            }}
            options={leadUserOptions.options}
            onSearch={leadUserOptions.search}
            loading={leadUserOptions.isLoading}
            disabled={isSubmitting || !canReadUsers}
            placeholder={copy.picker.placeholder}
            searchPlaceholder={copy.picker.searchPlaceholder}
            loadingLabel={copy.picker.loading}
            emptyLabel={copy.picker.empty}
            clearLabel={copy.picker.clear}
          />
        </Field>
      ) : null}

      {mode === "edit" ? (
        <Field label={copy.fields.status} hint={copy.fields.statusHint} showLabel>
          <Select
            value={values.status}
            onValueChange={(next) =>
              onChange({ status: next === "INACTIVE" ? "INACTIVE" : "ACTIVE" })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORG_NODE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {copy.orgStatus[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </div>
  );
}
