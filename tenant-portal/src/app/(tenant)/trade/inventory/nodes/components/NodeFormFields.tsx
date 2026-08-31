"use client";

import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  NODE_CODE_MAX_LENGTH,
  NODE_NAME_MAX_LENGTH,
  NODE_STATUSES,
  NODE_TIMEZONE_MAX_LENGTH,
  NODE_TYPES,
  type NodeFormValues,
} from "../../inventory-contract";

interface NodeFormFieldsProps {
  values: NodeFormValues;
  onChange: (patch: Partial<NodeFormValues>) => void;
  isSubmitting: boolean;
  /** `UpdateNodeDto` has no `code` or `nodeType` — both are fixed at create. */
  isEdit: boolean;
}

export function NodeFormFields({ values, onChange, isSubmitting, isEdit }: NodeFormFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      <Field label={t.tradeInventory.nodeCode} required readOnly={isEdit}>
        <Input
          value={values.code}
          maxLength={NODE_CODE_MAX_LENGTH}
          readOnly={isEdit}
          disabled={isSubmitting}
          onChange={(event) => onChange({ code: event.target.value })}
        />
      </Field>

      <Field label={t.tradeInventory.nodeName} required>
        <Input
          value={values.name}
          maxLength={NODE_NAME_MAX_LENGTH}
          disabled={isSubmitting}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>

      <Field label={t.tradeInventory.nodeType} required readOnly={isEdit}>
        <Select
          value={values.nodeType}
          disabled={isSubmitting || isEdit}
          onValueChange={(next) => onChange({ nodeType: next as NodeFormValues["nodeType"] })}
        >
          <SelectTrigger aria-label={t.tradeInventory.nodeType}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NODE_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {t.tradeStatus[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {isEdit ? (
        <Field label={t.common.status} required>
          <Select
            value={values.status}
            disabled={isSubmitting}
            onValueChange={(next) => onChange({ status: next as NodeFormValues["status"] })}
          >
            <SelectTrigger aria-label={t.common.status}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NODE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t.tradeStatus[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <Field label={t.tradeInventory.nodeTimezone} required hint={t.tradeInventory.nodeTimezoneHint}>
        <Input
          value={values.timezone}
          maxLength={NODE_TIMEZONE_MAX_LENGTH}
          disabled={isSubmitting}
          onChange={(event) => onChange({ timezone: event.target.value })}
        />
      </Field>

      <Field
        label={t.tradeInventory.nodeBranches}
        required
        hint={t.tradeInventory.nodeBranchesHint}
      >
        <Textarea
          value={values.branchIds}
          rows={4}
          disabled={isSubmitting}
          onChange={(event) => onChange({ branchIds: event.target.value })}
        />
      </Field>
    </div>
  );
}
