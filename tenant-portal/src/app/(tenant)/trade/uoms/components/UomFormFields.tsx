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
  UOM_CODE_MAX_LENGTH,
  UOM_DISPLAY_NAME_MAX_LENGTH,
  UOM_NOTE_MAX_LENGTH,
  UOM_REFERENCE_MAX_LENGTH,
  UOM_SOURCE_KIND_MAX_LENGTH,
  UOM_STATUSES,
  type UomFormValues,
  type UomStatus,
} from "../uom-contract";

interface UomFormFieldsProps {
  values: UomFormValues;
  onChange: (patch: Partial<UomFormValues>) => void;
  isSubmitting: boolean;
  /** `CreateUomDto` has a code; `UpdateUomDto` does not — it cannot be changed. */
  codeReadOnly: boolean;
  showStatus: boolean;
}

export function UomFormFields({
  values,
  onChange,
  isSubmitting,
  codeReadOnly,
  showStatus,
}: UomFormFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t.trade.uomCode}
        hint={t.trade.uomCodeHint}
        readOnly={codeReadOnly}
        required={!codeReadOnly}
      >
        <Input
          dir="ltr"
          value={values.code}
          onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
          maxLength={UOM_CODE_MAX_LENGTH}
          disabled={isSubmitting}
          readOnly={codeReadOnly}
          required={!codeReadOnly}
        />
      </Field>

      <Field label={t.trade.uomDisplayName} required>
        <Input
          value={values.displayName}
          onChange={(event) => onChange({ displayName: event.target.value })}
          maxLength={UOM_DISPLAY_NAME_MAX_LENGTH}
          disabled={isSubmitting}
          required
        />
      </Field>

      <Field label={t.trade.nameAr} hint={t.trade.localizedNamesHint}>
        <Input
          value={values.nameAr}
          onChange={(event) => onChange({ nameAr: event.target.value })}
          maxLength={UOM_DISPLAY_NAME_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.nameEn}>
        <Input
          dir="ltr"
          value={values.nameEn}
          onChange={(event) => onChange({ nameEn: event.target.value })}
          maxLength={UOM_DISPLAY_NAME_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.uomSourceKind} hint={t.trade.uomSourceKindHint} required>
        <Input
          value={values.sourceKind}
          onChange={(event) => onChange({ sourceKind: event.target.value })}
          maxLength={UOM_SOURCE_KIND_MAX_LENGTH}
          disabled={isSubmitting}
          required
        />
      </Field>

      <Field label={t.trade.uomReference}>
        <Input
          value={values.reference}
          onChange={(event) => onChange({ reference: event.target.value })}
          maxLength={UOM_REFERENCE_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.uomNote}>
        <Textarea
          value={values.note}
          onChange={(event) => onChange({ note: event.target.value })}
          maxLength={UOM_NOTE_MAX_LENGTH}
          disabled={isSubmitting}
        />
      </Field>

      {showStatus ? (
        <Field label={t.common.status} hint={t.trade.uomStatusHint}>
          <Select
            value={values.status}
            onValueChange={(next) => onChange({ status: next as UomStatus })}
            disabled={isSubmitting}
          >
            <SelectTrigger aria-label={t.common.status}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UOM_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t.trade[`uomStatus_${status}`]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </div>
  );
}
