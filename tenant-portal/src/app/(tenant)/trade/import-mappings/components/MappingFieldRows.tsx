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
import {
  EMPTY_IMPORT_MAPPING_FIELD,
  IMPORT_MAPPING_FIELDS_MAX,
  IMPORT_TRANSFORM_CODES,
  type ImportMappingFieldDraft,
} from "../import-mapping-contract";

interface MappingFieldRowsProps {
  fields: ImportMappingFieldDraft[];
  onChange: (fields: ImportMappingFieldDraft[]) => void;
  disabled: boolean;
}

/**
 * The mapping's column-to-field rows.
 *
 * `UpdateImportMappingDto` replaces `fields[]` wholesale — a row absent from
 * this editor is a row removed from the mapping — so the create drawer and the
 * detail screen edit the same complete list through this one component.
 *
 * `transformCode` values are shown verbatim: they are registry codes, not
 * user-facing states, and inventing a translation for one would misname it.
 */
export function MappingFieldRows({ fields, onChange, disabled }: MappingFieldRowsProps) {
  const { t } = useI18n();
  const patch = (index: number, next: Partial<ImportMappingFieldDraft>) =>
    onChange(fields.map((field, position) => (position === index ? { ...field, ...next } : field)));

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <div key={index} className="grid gap-3 border-t border-border pt-3 md:grid-cols-5">
          <Field label={t.tradeAutomation.sourceColumnCode} required>
            <Input
              value={field.sourceColumnCode}
              disabled={disabled}
              onChange={(event) => patch(index, { sourceColumnCode: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.sourceOrdinal} required>
            <Input
              type="number"
              min={0}
              max={999}
              value={field.sourceOrdinal}
              disabled={disabled}
              onChange={(event) => patch(index, { sourceOrdinal: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.targetFieldCode} required>
            <Input
              value={field.targetFieldCode}
              disabled={disabled}
              onChange={(event) => patch(index, { targetFieldCode: event.target.value })}
            />
          </Field>
          <Field label={t.tradeAutomation.transformCode} required>
            <Select
              value={field.transformCode}
              disabled={disabled}
              onValueChange={(next) =>
                patch(index, { transformCode: next as ImportMappingFieldDraft["transformCode"] })
              }
            >
              <SelectTrigger aria-label={t.tradeAutomation.transformCode}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_TRANSFORM_CODES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.tradeAutomation.isRequired}>
            <Switch
              checked={field.isRequired}
              disabled={disabled}
              onCheckedChange={(checked) => patch(index, { isRequired: checked })}
            />
          </Field>
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || fields.length >= IMPORT_MAPPING_FIELDS_MAX}
          onClick={() => onChange([...fields, EMPTY_IMPORT_MAPPING_FIELD])}
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
