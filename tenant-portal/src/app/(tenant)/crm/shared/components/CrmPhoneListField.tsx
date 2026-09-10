"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Field } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { CrmFormErrors } from "../hooks/useCrmCreateForm";
import { CrmPhoneNumberInput } from "./CrmPhoneNumberInput";

/**
 * `@ArrayMaxSize(10)` on every `phones` / `companyPhones` array in CRM.
 *
 * Exported because the lead detail's company card edits the same array under a
 * layout this component cannot produce — its label lives in the card's grid
 * rather than over each row — and the two must not disagree about the DTO's
 * own bounds.
 */
export const CRM_PHONE_LIST_MAX = 10;
/** `@MaxLength(32)` on every phone string in CRM. */
const CRM_PHONE_MAX_LENGTH = 32;

export interface CrmPhoneListFieldProps {
  label: string;
  hint?: string;
  phones: readonly string[];
  /** Error-key prefix — a row's message is at `<path>.<index>`. */
  path: string;
  errors: CrmFormErrors;
  disabled?: boolean;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onBlur: (path: string) => void;
}

/**
 * `phones[]` / `companyPhones[]` — `@ArrayMaxSize(10)`, 32 characters each.
 *
 * One `Field` per row rather than one label over a list: a duplicate is
 * rejected per number (`PARTY_DUPLICATE_CONTACT_METHOD`), so the message has to
 * be able to point at the row that caused it, and `Field` is what wires that
 * message to its input through `aria-describedby`.
 *
 * Each row is a country code and a national number rather than one free-text
 * box — see `CrmPhoneNumberInput`, which also owns the `dir="ltr"` a phone
 * number needs in an RTL paragraph, where the plus would otherwise jump to the
 * wrong end.
 */
export function CrmPhoneListField({
  label,
  hint,
  phones,
  path,
  errors,
  disabled,
  onChange,
  onAdd,
  onRemove,
  onBlur,
}: CrmPhoneListFieldProps) {
  const { t } = useI18n();
  const canAdd = phones.length < CRM_PHONE_LIST_MAX;

  return (
    <div className="flex flex-col gap-2">
      {phones.map((phone, index) => {
        const rowPath = `${path}.${index}`;
        return (
          <Field
            key={rowPath}
            label={index === 0 ? label : formatTemplate(t.crmShared.phoneNumbered, { number: index + 1 })}
            hint={index === 0 ? hint : undefined}
            error={errors[rowPath]}
          >
            <div className="flex items-center gap-1.5">
              <CrmPhoneNumberInput
                value={phone}
                maxLength={CRM_PHONE_MAX_LENGTH}
                disabled={disabled}
                onChange={(next) => onChange(index, next)}
                onBlur={() => onBlur(rowPath)}
              />
              {phones.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={formatTemplate(t.crmShared.removePhone, { number: index + 1 })}
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                </Button>
              )}
            </div>
          </Field>
        );
      })}
      {canAdd && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onAdd}
          className="self-start"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t.crmShared.addPhone}
        </Button>
      )}
    </div>
  );
}
