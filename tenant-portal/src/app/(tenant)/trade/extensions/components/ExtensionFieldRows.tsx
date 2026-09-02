"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  EMPTY_EXTENSION_FIELD_DRAFT,
  EXTENSION_DEFAULT_STRATEGIES,
  EXTENSION_FIELDS_MAX,
  EXTENSION_SCALAR_TYPES,
  EXTENSION_VALUE_KINDS,
  EXTENSION_VISIBILITY_CODES,
  type ExtensionFieldDraft,
} from "../extension-contract";

interface ExtensionFieldRowsProps {
  fields: ExtensionFieldDraft[];
  onChange: (fields: ExtensionFieldDraft[]) => void;
  disabled: boolean;
}

/**
 * The full field set, not a subset.
 *
 * `UpdateExtensionProfileDto` replaces `fields[]` wholesale, so anything this
 * editor cannot express would be silently dropped on the next save. Every
 * documented attribute is therefore editable here.
 */
export function ExtensionFieldRows({ fields, onChange, disabled }: ExtensionFieldRowsProps) {
  const { t } = useI18n();
  const patch = (index: number, next: Partial<ExtensionFieldDraft>) =>
    onChange(fields.map((field, position) => (position === index ? { ...field, ...next } : field)));

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field, index) => (
        <div key={index} className="grid gap-3 border-t border-border pt-3 md:grid-cols-4">
          <Field label={t.tradeAutomation.fieldKey} required>
            <Input
              value={field.fieldKey}
              maxLength={100}
              disabled={disabled}
              onChange={(event) => patch(index, { fieldKey: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.valueKind} required>
            <Select
              value={field.valueKind}
              disabled={disabled}
              onValueChange={(next) =>
                patch(index, { valueKind: next as ExtensionFieldDraft["valueKind"] })
              }
            >
              <SelectTrigger aria-label={t.tradeAutomation.valueKind}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXTENSION_VALUE_KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.tradeAutomation.scalarType}>
            <Select
              value={field.scalarType === "" ? undefined : field.scalarType}
              disabled={disabled}
              onValueChange={(next) =>
                patch(index, { scalarType: next as ExtensionFieldDraft["scalarType"] })
              }
            >
              <SelectTrigger aria-label={t.tradeAutomation.scalarType}>
                <SelectValue placeholder={t.tradeCommon.notSet} />
              </SelectTrigger>
              <SelectContent>
                {EXTENSION_SCALAR_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.tradeAutomation.visibilityCode} required>
            <Select
              value={field.visibilityCode}
              disabled={disabled}
              onValueChange={(next) =>
                patch(index, { visibilityCode: next as ExtensionFieldDraft["visibilityCode"] })
              }
            >
              <SelectTrigger aria-label={t.tradeAutomation.visibilityCode}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXTENSION_VISIBILITY_CODES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.tradeAutomation.maxLength}>
            <Input
              type="number"
              min={1}
              max={4096}
              value={field.maxLength}
              disabled={disabled}
              onChange={(event) => patch(index, { maxLength: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.maxItems}>
            <Input
              type="number"
              min={1}
              max={100}
              value={field.maxItems}
              disabled={disabled}
              onChange={(event) => patch(index, { maxItems: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.decimalScale} hint={t.tradeAutomation.decimalScaleHint}>
            <Input
              type="number"
              min={0}
              max={8}
              value={field.decimalScale}
              disabled={disabled}
              onChange={(event) => patch(index, { decimalScale: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.defaultStrategy} required>
            <Select
              value={field.defaultStrategy}
              disabled={disabled}
              onValueChange={(next) =>
                patch(index, { defaultStrategy: next as ExtensionFieldDraft["defaultStrategy"] })
              }
            >
              <SelectTrigger aria-label={t.tradeAutomation.defaultStrategy}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXTENSION_DEFAULT_STRATEGIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.tradeAutomation.minimumDecimal} hint={t.tradeCommon.decimalHint}>
            <Input
              value={field.minimumDecimal}
              inputMode="decimal"
              disabled={disabled}
              onChange={(event) => patch(index, { minimumDecimal: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.maximumDecimal} hint={t.tradeCommon.decimalHint}>
            <Input
              value={field.maximumDecimal}
              inputMode="decimal"
              disabled={disabled}
              onChange={(event) => patch(index, { maximumDecimal: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.isRequired}>
            <Switch
              checked={field.isRequired}
              disabled={disabled}
              onCheckedChange={(checked) => patch(index, { isRequired: checked })}
            />
          </Field>
          <Field label={t.tradeAutomation.isSearchable}>
            <Switch
              checked={field.isSearchable}
              disabled={disabled}
              onCheckedChange={(checked) => patch(index, { isSearchable: checked })}
            />
          </Field>
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || fields.length >= EXTENSION_FIELDS_MAX}
          onClick={() => onChange([...fields, EMPTY_EXTENSION_FIELD_DRAFT])}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t.tradeAutomation.addField}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || fields.length <= 1}
          onClick={() => onChange(fields.slice(0, -1))}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t.tradeAutomation.removeField}
        </Button>
      </div>
    </div>
  );
}
