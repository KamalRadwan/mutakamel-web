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
  EMPTY_EXTENSION_PROFILE_FORM,
  EXTENSION_SCOPE_TARGETS,
  EXTENSION_TARGET_CODES,
  type ExtensionProfileFormValues,
} from "../extension-contract";
import { ExtensionFieldRows } from "./ExtensionFieldRows";

interface CreateExtensionProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ExtensionProfileFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateExtensionProfileModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateExtensionProfileModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<ExtensionProfileFormValues>(EMPTY_EXTENSION_PROFILE_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_EXTENSION_PROFILE_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_EXTENSION_PROFILE_FORM);
          onClose();
        }
      }}
      title={t.tradeAutomation.profileCreateTitle}
      description={t.tradeAutomation.profileCreateDescription}
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
        <Field label={t.tradeAutomation.targetCode} required>
          <Select
            value={values.targetCode}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                targetCode: next as ExtensionProfileFormValues["targetCode"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeAutomation.targetCode}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXTENSION_TARGET_CODES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={t.tradeGovernance.scopeTarget}
          required
          hint={t.tradeAutomation.scopeTargetHint}
        >
          <Select
            value={values.scopeTarget}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                scopeTarget: next as ExtensionProfileFormValues["scopeTarget"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradeGovernance.scopeTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXTENSION_SCOPE_TARGETS.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <p className="text-sm font-medium text-foreground">{t.tradeAutomation.fields}</p>
        <ExtensionFieldRows
          fields={values.fields}
          onChange={(fields) => setValues((current) => ({ ...current, fields }))}
          disabled={isSubmitting}
        />
      </div>
    </FormDrawer>
  );
}
