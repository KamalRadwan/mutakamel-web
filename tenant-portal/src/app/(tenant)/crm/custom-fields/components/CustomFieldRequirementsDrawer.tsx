"use client";

import { useState } from "react";
import { Field, FormDrawer, Switch } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  CRM_FIELD_REQUIREMENT_OPERATIONS,
  type CustomFieldItem,
} from "../custom-field-contract";
import type { RequirementFlags } from "../hooks/useCustomFieldRequirements";

interface CustomFieldRequirementsDrawerProps {
  field: CustomFieldItem | null;
  initialFlags: RequirementFlags | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (flags: RequirementFlags) => void;
}

const EMPTY: RequirementFlags = {
  CREATE: false,
  UPDATE: false,
  CONVERT: false,
};

// POST /custom-fields/:id/requirements, one call per changed operation.
// Requirements are per-operation, never global: a field required for CREATE
// blocks the create form and leaves edit alone.
export function CustomFieldRequirementsDrawer({
  field,
  initialFlags,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: CustomFieldRequirementsDrawerProps) {
  const { t } = useI18n();
  // Seeded once; the caller remounts this drawer per field it opens for.
  const [flags, setFlags] = useState<RequirementFlags>(initialFlags ?? EMPTY);

  const baseline = initialFlags ?? EMPTY;
  const isDirty = CRM_FIELD_REQUIREMENT_OPERATIONS.some(
    (operation) => flags[operation] !== baseline[operation],
  );

  return (
    <FormDrawer
      open={field !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.crmCustomFields.requirementsTitle}
      description={t.crmCustomFields.requirementsDescription}
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      submitDisabled={!isDirty}
      error={error ?? undefined}
      onSubmit={() => onSubmit(flags)}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      {CRM_FIELD_REQUIREMENT_OPERATIONS.map((operation) => (
        <Field
          key={operation}
          label={t.crmCustomFields.requirementOperations[operation]}
          hint={t.crmCustomFields.requirementHints[operation]}
        >
          <div className="flex items-center gap-2">
            <Switch
              checked={flags[operation]}
              aria-label={t.crmCustomFields.requirementOperations[operation]}
              onCheckedChange={(checked) =>
                setFlags((current) => ({ ...current, [operation]: checked }))
              }
            />
            <span className="text-sm text-foreground">
              {flags[operation]
                ? t.crmCustomFields.required
                : t.crmCustomFields.optional}
            </span>
          </div>
        </Field>
      ))}

      <p className="text-xs text-muted-foreground">
        {t.crmCustomFields.requirementsScopeNote}
      </p>
    </FormDrawer>
  );
}
