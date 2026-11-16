"use client";

import {
  Field,
  FormDrawer,
  IdentifierText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  TEMPLATE_ADAPTER_KEYS,
  TEMPLATE_DOCUMENT_TYPES,
  TEMPLATE_LOCALES,
  TEMPLATE_OUTPUT_CHANNELS,
} from "../../templates-contract";
import {
  ASSIGNMENT_PRIORITY_MAX,
  type AssignmentScope,
  type TemplateAssignment,
} from "../../template-assignments-contract";
import type { AssignmentFormValues, AssignmentVersionPin } from "../hooks/useTemplateAssignments";
import { useAssignmentDrawer } from "../hooks/useAssignmentDrawer";
import { AssignmentChoiceField } from "./AssignmentChoiceField";

const ANY_LOCALE = "ANY";

export function AssignmentDrawer({
  assignment,
  scope,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  isCurrent,
}: {
  assignment: TemplateAssignment | null;
  scope: AssignmentScope;
  onClose: () => void;
  onSubmit: (values: AssignmentFormValues, selectedPin?: AssignmentVersionPin) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  isCurrent: () => boolean;
}) {
  const { t, lang, dir } = useI18n();
  const copy = t.coreOperations.templates;
  const form = useAssignmentDrawer(assignment, scope, isCurrent);
  const { values, change, changeSelector } = form;
  const templateOptions = form.templates.items.map(item => ({
    value: item.id,
    label: `${item.name} · ${item.code} · ${copy.locales[item.locale as keyof typeof copy.locales] ?? item.locale}`,
  }));
  if (form.template && !templateOptions.some(option => option.value === form.template?.id)) {
    templateOptions.unshift({ value: form.template.id, label: `${form.template.name} · ${form.template.code}` });
  }
  const versionOptions = form.versions.items.map(item => ({
    value: item.id,
    label: formatTemplate(copy.versionLabel, { number: formatNumber(item.versionNumber, lang) }),
  }));
  if (form.selectedVersion && !versionOptions.some(option => option.value === form.selectedVersion?.id)) {
    versionOptions.unshift({
      value: form.selectedVersion.id,
      label: formatTemplate(copy.versionLabel, { number: formatNumber(form.selectedVersion.versionNumber, lang) }),
    });
  }

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={assignment ? copy.assignmentEditTitle : copy.assignmentCreateTitle}
      description={copy.assignmentDescription}
      isDirty={form.isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values, form.selectedPin)}
      submitDisabled={!form.canSubmit}
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
        {assignment ? null : (
          <>
            <Field label={copy.documentType} showLabel required>
              <Select
                dir={dir}
                value={values.documentType}
                onValueChange={(value) => changeSelector({ documentType: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger size="sm">
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

            <Field label={copy.outputChannel} showLabel required>
              <Select
                dir={dir}
                value={values.outputChannel}
                onValueChange={(value) => changeSelector({ outputChannel: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger size="sm">
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

            <Field label={copy.dataSource} showLabel required>
              <Select
                dir={dir}
                value={values.adapterKey}
                onValueChange={(value) => changeSelector({ adapterKey: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger size="sm">
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

            <Field label={copy.locale} showLabel>
              <Select
                dir={dir}
                value={values.locale || ANY_LOCALE}
                onValueChange={(value) => changeSelector({ locale: value === ANY_LOCALE ? "" : value })}
                disabled={isSubmitting}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {form.sales ? <SelectItem value={ANY_LOCALE}>{copy.assignmentDefaultLocale}</SelectItem> : null}
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

        {form.sales ? (
          <>
            {!assignment ? (
              <AssignmentChoiceField label={t.crmOutboundEmails.template} options={templateOptions} value={form.template?.id}
                onChange={form.selectTemplate} disabled={isSubmitting} empty={copy.empty} failure={copy.loadFailed}
                page={form.templates} />
            ) : null}
            {assignment || form.template ? (
              <AssignmentChoiceField label={copy.assignmentVersion} options={versionOptions} value={values.versionId}
                onChange={form.selectVersion} disabled={isSubmitting} empty={copy.versionsEmpty}
                failure={copy.versionsLoadFailed} page={form.versions} />
            ) : null}
            {values.versionId ? <IdentifierText className="text-xs" selectAll>{values.versionId}</IdentifierText> : null}
          </>
        ) : (
          <Field label={copy.assignmentVersionId} hint={copy.assignmentVersionIdHint} required>
            <Input size="sm" placeholder={copy.assignmentVersionId}
              dir="ltr"
              value={values.versionId}
              onChange={(event) => change({ versionId: event.target.value.trim() })}
              disabled={isSubmitting}
              required
            />
          </Field>
        )}

        <Field label={copy.assignmentPriority} hint={copy.assignmentPriorityHint} required>
          <Input size="sm" placeholder={copy.assignmentPriority}
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
          <Input size="sm" placeholder={copy.assignmentEffectiveFrom}
            dir="ltr"
            type="datetime-local"
            value={values.effectiveFrom}
            onChange={(event) => change({ effectiveFrom: event.target.value })}
            disabled={isSubmitting}
            required
          />
        </Field>

        <Field label={copy.assignmentEffectiveTo} hint={copy.assignmentEffectiveToHint}>
          <Input size="sm" placeholder={copy.assignmentEffectiveTo}
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
