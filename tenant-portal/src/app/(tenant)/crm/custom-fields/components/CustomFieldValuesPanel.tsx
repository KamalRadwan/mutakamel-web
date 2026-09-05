"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Combobox,
  DetailSection,
  EmptyState,
  ErrorState,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useToast,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { localizedValue } from "@/lib/format/localized";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import {
  CRM_RECORD_SOURCE_TYPES,
  useCrmRecordOptions,
  type CrmRecordSourceType,
} from "@/hooks/useCrmRecordOptions";
import type { CustomFieldItem } from "../custom-field-contract";
import { useCustomFieldValues } from "../hooks/useCustomFieldValues";
import { CustomFieldValueInput } from "../../shared/components/CustomFieldValueInput";

interface CustomFieldValuesPanelProps {
  definitions: CustomFieldItem[];
  canManage: boolean;
}

/**
 * `GET`/`POST /custom-fields/values` — the values half of task 8.19.
 *
 * Values belong to a record, so this panel asks for one: a branch, an owner
 * type and an owner record. Nothing is fetched until all three resolve, and
 * nothing is invented in the meantime — the empty state says which step is
 * outstanding rather than showing a form over no record.
 */
export function CustomFieldValuesPanel({
  definitions,
  canManage,
}: CustomFieldValuesPanelProps) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const [ownerType, setOwnerType] = useState<CrmRecordSourceType>("LEAD");
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const [ownerLabel, setOwnerLabel] = useState<string | undefined>(undefined);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const records = useCrmRecordOptions(ownerType, branchId);
  const values = useCustomFieldValues(branchId);

  // A definition applies to this owner when its ownerType matches, and a
  // LEAD_AND_PARTY definition applies to both halves of that pair.
  const applicable = useMemo(
    () =>
      definitions.filter(
        (definition) =>
          definition.isActive &&
          (definition.ownerType === ownerType ||
            (definition.ownerType === "LEAD_AND_PARTY" &&
              (ownerType === "LEAD" || ownerType === "CUSTOMER_PROFILE"))),
      ),
    [definitions, ownerType],
  );

  const storedValue = (fieldId: string): unknown =>
    values.values.find((entry) => entry.fieldDefinitionId === fieldId)?.value;

  function selectOwner(next: string | undefined) {
    setOwnerId(next);
    setOwnerLabel(records.options.find((option) => option.value === next)?.label);
    setDrafts({});
    if (next) void values.load(ownerType, next);
    else values.reset();
  }

  return (
    <DetailSection
      title={t.crmCustomFields.valuesTitle}
      description={t.crmCustomFields.valuesDescription}
      columns={1}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <TenantBranchSelect
            branchIds={branchIds}
            branchId={branchId}
            onChange={(next) => {
              selectBranch(next);
              selectOwner(undefined);
            }}
          />
          <div className="min-w-44">
            <Field label={t.crmCustomFields.owner}>
              <Select
                value={ownerType}
                onValueChange={(next) => {
                  setOwnerType(next as CrmRecordSourceType);
                  selectOwner(undefined);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRM_RECORD_SOURCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t.crmCustomFields.ownerTypes[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="min-w-64 flex-1">
            <Field label={t.crmCustomFields.ownerRecord}>
              <Combobox
                value={ownerId}
                selectedLabel={ownerLabel}
                onValueChange={selectOwner}
                options={records.options}
                onSearch={records.search}
                loading={records.isLoading}
                placeholder={t.crmCustomFields.ownerRecordPlaceholder}
                searchPlaceholder={t.common.search}
                loadingLabel={t.common.loading}
                emptyLabel={
                  records.error
                    ? t.crmCustomFields.ownerRecordsUnavailable
                    : t.crmCustomFields.ownerRecordsEmpty
                }
                clearLabel={t.common.dismiss}
              />
            </Field>
          </div>
        </div>

        {!branchId ? (
          <EmptyState
            title={t.crmCustomFields.branchRequiredTitle}
            description={t.crmCustomFields.branchRequiredDescription}
          />
        ) : !ownerId ? (
          <EmptyState
            title={t.crmCustomFields.pickOwnerTitle}
            description={t.crmCustomFields.pickOwnerDescription}
          />
        ) : values.loadError ? (
          <ErrorState
            title={t.crmCustomFields.valuesLoadFailed}
            description={t.crmCustomFields.valuesLoadFailedHint}
            retryLabel={t.common.retry}
            onRetry={() => void values.load(ownerType, ownerId)}
          />
        ) : values.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : applicable.length === 0 ? (
          <EmptyState
            title={t.crmCustomFields.noApplicableTitle}
            description={t.crmCustomFields.noApplicableDescription}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {applicable.map((field) => {
              const draft = field.id in drafts ? drafts[field.id] : storedValue(field.id);
              return (
                <li key={field.id} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-64 flex-1">
                    <Field
                      label={localizedValue(field.nameAr, field.nameEn, lang)}
                      hint={field.fieldKey}
                      readOnly={!canManage}
                    >
                      <CustomFieldValueInput
                        field={field}
                        value={draft}
                        disabled={!canManage || values.isSaving}
                        onChange={(next) =>
                          setDrafts((current) => ({ ...current, [field.id]: next }))
                        }
                      />
                    </Field>
                  </div>
                  {canManage ? (
                    <Button
                      variant="outline"
                      disabled={!(field.id in drafts) || values.isSaving}
                      onClick={() => {
                        void values
                          .save(field, ownerType, ownerId, drafts[field.id])
                          .then((result) => {
                            if (result.ok) {
                              setDrafts((current) => {
                                const next = { ...current };
                                delete next[field.id];
                                return next;
                              });
                              toast.success(t.crmCustomFields.valueSaved);
                              return;
                            }
                            if (result.error && !toast.outcomeFromApi(result.error)) {
                              toast.errorFromApi(
                                t.crmCustomFields.valueSaveFailed,
                                result.error,
                              );
                            }
                          });
                      }}
                    >
                      {t.common.save}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DetailSection>
  );
}
