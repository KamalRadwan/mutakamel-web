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
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  TEMPLATE_ADAPTER_KEYS,
  TEMPLATE_DOCUMENT_TYPES,
  TEMPLATE_LOCALES,
  TEMPLATE_OUTPUT_CHANNELS,
} from "../../templates-contract";
import {
  ASSIGNMENT_PRIORITY_MAX,
  type TemplateAssignment,
} from "../../template-assignments-contract";
import {
  EMPTY_ASSIGNMENT_FORM,
  type AssignmentFormValues,
} from "../hooks/useTemplateAssignments";

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AssignmentDrawer({
  assignment,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  assignment: TemplateAssignment | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: AssignmentFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  const copy = t.coreOperations.templates;
  const initial: AssignmentFormValues = assignment
    ? {
        versionId: assignment.versionId,
        adapterKey: assignment.adapterKey,
        documentType: assignment.documentType,
        outputChannel: assignment.outputChannel,
        locale: assignment.locale ?? "",
        priority: String(assignment.priority),
        isDefault: assignment.isDefault,
        effectiveFrom: toLocalInput(assignment.effectiveFrom),
        effectiveTo: assignment.effectiveTo ? toLocalInput(assignment.effectiveTo) : "",
      }
    : EMPTY_ASSIGNMENT_FORM;
  const [values, setValues] = useState<AssignmentFormValues>(initial);
  const change = (patch: Partial<AssignmentFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={assignment ? copy.assignmentEditTitle : copy.assignmentCreateTitle}
      description={copy.assignmentDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
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
      <div className="flex flex-col gap-4">
        <Field label={copy.assignmentVersionId} hint={copy.assignmentVersionIdHint} required>
          <Input
            dir="ltr"
            value={values.versionId}
            onChange={(event) => change({ versionId: event.target.value.trim() })}
            disabled={isSubmitting}
            required
          />
        </Field>

        {assignment ? null : (
          <>
            <Field label={copy.documentType} required>
              <Select
                value={values.documentType}
                onValueChange={(value) => change({ documentType: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_DOCUMENT_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {copy.documentTypes[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={copy.outputChannel} required>
              <Select
                value={values.outputChannel}
                onValueChange={(value) => change({ outputChannel: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_OUTPUT_CHANNELS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {copy.outputChannels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={copy.dataSource} required>
              <Select
                value={values.adapterKey}
                onValueChange={(value) => change({ adapterKey: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_ADAPTER_KEYS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {copy.adapterKeys[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={copy.locale} hint={copy.assignmentLocaleHint}>
              <Select
                value={values.locale}
                onValueChange={(value) => change({ locale: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_LOCALES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {copy.locales[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        <Field label={copy.assignmentPriority} hint={copy.assignmentPriorityHint} required>
          <Input
            dir="ltr"
            inputMode="numeric"
            value={values.priority}
            onChange={(event) => change({ priority: event.target.value })}
            maxLength={String(ASSIGNMENT_PRIORITY_MAX).length}
            disabled={isSubmitting}
            required
          />
        </Field>

        <Field label={copy.assignmentIsDefault} hint={copy.assignmentIsDefaultHint}>
          <Switch
            checked={values.isDefault}
            onCheckedChange={(checked) => change({ isDefault: checked })}
            disabled={isSubmitting}
          />
        </Field>

        <Field label={copy.assignmentEffectiveFrom} required>
          <Input
            dir="ltr"
            type="datetime-local"
            value={values.effectiveFrom}
            onChange={(event) => change({ effectiveFrom: event.target.value })}
            disabled={isSubmitting}
            required
          />
        </Field>

        <Field label={copy.assignmentEffectiveTo} hint={copy.assignmentEffectiveToHint}>
          <Input
            dir="ltr"
            type="datetime-local"
            value={values.effectiveTo}
            onChange={(event) => change({ effectiveTo: event.target.value })}
            disabled={isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
