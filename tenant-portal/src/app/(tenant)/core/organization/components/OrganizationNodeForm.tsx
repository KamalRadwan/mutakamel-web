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
  ORG_CODE_MAX_LENGTH,
  ORG_CURRENCY_CODE_LENGTH,
  ORG_LEGAL_NAME_MAX_LENGTH,
  ORG_NAME_MAX_LENGTH,
  ORG_NODE_STATUSES,
  ORG_PHONE_MAX_LENGTH,
  ORG_TAX_NUMBER_MAX_LENGTH,
} from "../../contracts/organization-contract";
import type { RemoteOptions } from "../../hooks/useCoreOptions";
import type { OrgLevelConfig } from "../level-config";
import type { OrgNodeFormValues } from "../hooks/useOrganizationLevel";

interface OrganizationNodeFormProps {
  config: OrgLevelConfig;
  values: OrgNodeFormValues;
  onChange: (patch: Partial<OrgNodeFormValues>) => void;
  /** Create sends `code` and the parent id; update sends neither, plus `status`. */
  mode: "create" | "edit";
  isSubmitting: boolean;
  parentOptions: RemoteOptions;
  leadUserOptions: RemoteOptions;
}

export function OrganizationNodeForm({
  config,
  values,
  onChange,
  mode,
  isSubmitting,
  parentOptions,
  leadUserOptions,
}: OrganizationNodeFormProps) {
  const { t } = useI18n();
  const copy = t.coreIdentity;
  const levelCopy = copy.levels[config.level];

  return (
    <div className="flex flex-col gap-4">
      {mode === "create" && config.parent ? (
        <Field label={copy.levels[config.parent].parentLabel} required>
          <Combobox
            value={values.parentId || undefined}
            selectedLabel={parentOptions.labelFor(values.parentId)}
            onValueChange={(next) => onChange({ parentId: next ?? "" })}
            options={parentOptions.options}
            onSearch={parentOptions.search}
            loading={parentOptions.isLoading}
            disabled={isSubmitting}
            placeholder={copy.picker.placeholder}
            searchPlaceholder={copy.picker.searchPlaceholder}
            loadingLabel={copy.picker.loading}
            emptyLabel={copy.picker.empty}
          />
        </Field>
      ) : null}

      {mode === "create" ? (
        <Field label={copy.fields.code} hint={copy.fields.codeHint} required>
          <Input
            dir="ltr"
            value={values.code}
            onChange={(event) => onChange({ code: event.target.value })}
            maxLength={ORG_CODE_MAX_LENGTH}
            disabled={isSubmitting}
            required
          />
        </Field>
      ) : null}

      <Field label={levelCopy.nameLabel} required>
        <Input
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          maxLength={ORG_NAME_MAX_LENGTH}
          disabled={isSubmitting}
          required
        />
      </Field>

      {config.fields.includes("legalName") ? (
        <Field label={copy.fields.legalName}>
          <Input
            value={values.legalName}
            onChange={(event) => onChange({ legalName: event.target.value })}
            maxLength={ORG_LEGAL_NAME_MAX_LENGTH}
            disabled={isSubmitting}
          />
        </Field>
      ) : null}

      {config.fields.includes("taxNumber") ? (
        <Field label={copy.fields.taxNumber}>
          <Input
            dir="ltr"
            value={values.taxNumber}
            onChange={(event) => onChange({ taxNumber: event.target.value })}
            maxLength={ORG_TAX_NUMBER_MAX_LENGTH}
            disabled={isSubmitting}
          />
        </Field>
      ) : null}

      {config.fields.includes("currencyCode") ? (
        <Field label={copy.fields.currencyCode} hint={copy.fields.currencyCodeHint}>
          <Input
            dir="ltr"
            value={values.currencyCode}
            onChange={(event) => onChange({ currencyCode: event.target.value })}
            maxLength={ORG_CURRENCY_CODE_LENGTH}
            disabled={isSubmitting}
          />
        </Field>
      ) : null}

      {config.fields.includes("address") ? (
        <Field label={copy.fields.address}>
          <Textarea
            value={values.address}
            onChange={(event) => onChange({ address: event.target.value })}
            maxLength={ORG_ADDRESS_MAX_LENGTH}
            disabled={isSubmitting}
            rows={3}
          />
        </Field>
      ) : null}

      {config.fields.includes("phone") ? (
        <Field label={copy.fields.phone}>
          <Input
            dir="ltr"
            value={values.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            maxLength={ORG_PHONE_MAX_LENGTH}
            disabled={isSubmitting}
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
        <Field label={copy.fields.leadUser}>
          <Combobox
            value={values.leadUserId || undefined}
            selectedLabel={leadUserOptions.labelFor(values.leadUserId)}
            onValueChange={(next) => onChange({ leadUserId: next ?? "" })}
            options={leadUserOptions.options}
            onSearch={leadUserOptions.search}
            loading={leadUserOptions.isLoading}
            disabled={isSubmitting}
            placeholder={copy.picker.placeholder}
            searchPlaceholder={copy.picker.searchPlaceholder}
            loadingLabel={copy.picker.loading}
            emptyLabel={copy.picker.empty}
            clearLabel={copy.picker.clear}
          />
        </Field>
      ) : null}

      {mode === "edit" ? (
        <Field label={copy.fields.status} hint={copy.fields.statusHint}>
          <Select
            value={values.status}
            onValueChange={(next) =>
              onChange({ status: next === "INACTIVE" ? "INACTIVE" : "ACTIVE" })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
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
