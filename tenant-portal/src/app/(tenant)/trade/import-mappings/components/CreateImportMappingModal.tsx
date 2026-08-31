"use client";

import { useState } from "react";
import {
  Field,
  FormDrawer,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  EMPTY_IMPORT_MAPPING_FORM,
  IMPORT_MAPPING_SCOPE_TARGETS,
  IMPORT_MAPPING_TARGET_CODES,
  type ImportMappingFormValues,
} from "../import-mapping-contract";
import { MappingFieldRows } from "./MappingFieldRows";

interface CreateImportMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ImportMappingFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateImportMappingModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateImportMappingModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<ImportMappingFormValues>(EMPTY_IMPORT_MAPPING_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_IMPORT_MAPPING_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_IMPORT_MAPPING_FORM);
          onClose();
        }
      }}
      title={t.tradeAutomation.mappingCreateTitle}
      description={t.tradeAutomation.mappingCreateDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-3">
        <Field label={t.tradeAutomation.code} required hint={t.tradeGovernance.codeHint}>
          <Input
            value={values.code}
            maxLength={100}
            disabled={isSubmitting}
            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
          />
        </Field>
        <Field label={t.tradeAutomation.targetCode} required hint={t.tradeAutomation.targetCodeHint}>
          <Select
            value={values.targetCode}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                targetCode: next as ImportMappingFormValues["targetCode"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeAutomation.targetCode}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPORT_MAPPING_TARGET_CODES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t.tradeGovernance.scopeTarget} required>
          <Select
            value={values.scopeTarget}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                scopeTarget: next as ImportMappingFormValues["scopeTarget"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeGovernance.scopeTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPORT_MAPPING_SCOPE_TARGETS.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <p className="text-sm font-medium text-foreground">{t.tradeAutomation.mappingFields}</p>
        <p className="text-xs text-muted-foreground">{t.tradeAutomation.executionModeHint}</p>

        <MappingFieldRows
          fields={values.fields}
          onChange={(fields) => setValues((current) => ({ ...current, fields }))}
          disabled={isSubmitting}
        />
      </div>
    </FormDrawer>
  );
}
