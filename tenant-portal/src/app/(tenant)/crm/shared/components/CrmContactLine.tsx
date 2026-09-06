"use client";

import { useEffect, useRef } from "react";
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
} from "@/design-system";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { findHonorific, getHonorificOptions } from "@/lib/catalogues/contact-titles";
import type { CrmFormErrors } from "../hooks/useCrmCreateForm";
import { CrmJobTitleField } from "./CrmJobTitleField";
import { CrmPhoneNumberInput } from "./CrmPhoneNumberInput";

/** `@ArrayMaxSize(10)` on every `phones` array in CRM. */
const CRM_PHONE_LIST_MAX = 10;
/** `@MaxLength(32)` on every phone string in CRM. */
const CRM_PHONE_MAX_LENGTH = 32;

interface CrmContactLineFields {
  honorificTitle: string;
  /**
   * Kept for a directory-owned person, whose name this form cannot change and
   * only displays. A new contact is named by its parts instead — CRM composes
   * the rendered name, so nobody types the same person's name twice.
   */
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
}

export interface CrmContactLineProps {
  /** Error-key prefix — a field's message is at `<path>.<field>`. */
  path: string;
  contact: CrmContactLineFields & { phones: readonly string[] };
  errors: CrmFormErrors;
  disabled?: boolean;
  /**
   * Caps that differ per record type, from that screen's own contract.
   * `name` caps EACH name part — `@MaxLength(80)` on `firstName` and on
   * `lastName` — not the composed name, which is the server's to build.
   */
  limits: { name: number; jobTitle: number; email: number };
  /**
   * Names the single read-only box a DIRECTORY person gets, which really does
   * hold a whole name — "Contact name" and the like.
   *
   * It does NOT name the editable boxes. Those are a first name and a last
   * name, and they take the shared labels below: a caller that passed
   * "Contact name" here was putting a whole-name label over a first-name box,
   * with "Last name" sitting beside it. That is the bug this rename exists to
   * make unsayable.
   */
  directoryNameLabel: string;
  /**
   * A person reused from the directory. The service ignores every field
   * submitted for one except the job title and the primary flag, so the line
   * shows the name it already has and the one thing this form can still set.
   */
  directoryOwned?: boolean;
  identityHint?: string;
  onFieldChange: (patch: Partial<CrmContactLineFields>) => void;
  onPhoneChange: (index: number, value: string) => void;
  /**
   * A lead or customer who IS a person has no job title on their own record —
   * only a contact at a company does. Everything else about the two is the
   * same shape, which is why they share this line rather than each having a
   * form of its own.
   */
  showJobTitle?: boolean;
  /** Omit on a form that holds a single number: no add control, no extra rows. */
  onPhoneAdd?: () => void;
  onPhoneRemove?: (index: number) => void;
  onBlur: (path: string) => void;
}

/**
 * One contact, on one line: honorific, name, job title, number, email.
 *
 * The columns are sized to what goes in them rather than split evenly — an
 * honorific needs 7rem and an email needs whatever is left, and equal columns
 * made "Mr" as wide as "operations@…". Below `xl` the line breaks into two
 * columns and then one, because five controls in a row stop being readable
 * long before the viewport stops being wide.
 *
 * A second and further number drop BELOW the line rather than stretching it.
 * The overwhelming case is one number, and a row that grows sideways with
 * every extra one would make the common case pay for the rare one.
 */
export function CrmContactLine({
  path,
  contact,
  errors,
  disabled,
  limits,
  directoryNameLabel,
  showJobTitle = true,
  directoryOwned,
  identityHint,
  onFieldChange,
  onPhoneChange,
  onPhoneAdd,
  onPhoneRemove,
  onBlur,
}: CrmContactLineProps) {
  const { t, lang } = useI18n();
  const honorifics = getHonorificOptions(lang);
  const honorific = findHonorific(contact.honorificTitle, lang);
  const extraPhones = onPhoneRemove ? contact.phones.slice(1) : [];

  // A blank row starts on the commonest honorific rather than on nothing, and
  // it is really written rather than merely shown: a picker displaying a value
  // the form does not hold would submit an empty one. Once only, and never for
  // a directory person, whose honorific this form cannot set at all.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || directoryOwned) return;
    seededRef.current = true;
    if (contact.honorificTitle.trim().length > 0) return;
    const [first] = honorifics;
    if (first) queueMicrotask(() => onFieldChange({ honorificTitle: first.label }));
  }, [contact.honorificTitle, directoryOwned, honorifics, onFieldChange]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "grid grid-cols-1 gap-x-3 gap-y-3 md:grid-cols-2",
          // One row at xl, which is what the modal is sized for. The two name
          // boxes are fixed at 250px each — a first or last name has a known
          // length and stretching them only padded whitespace — and the slack
          // goes to the phone column, which holds a dial-code picker, a number
          // and an add button in one track and was the one control the line
          // squeezed. On the six-column line the job title and the email give
          // up a rem each for the same reason: both truncate anyway, and a
          // half-visible phone number is the one that cannot be read at all.
          // Written out rather than composed: Tailwind reads these as text.
          showJobTitle
            ? "xl:grid-cols-[5rem_250px_250px_9rem_minmax(0,1fr)_minmax(0,12rem)]"
            : "xl:grid-cols-[5rem_250px_250px_minmax(0,1fr)_minmax(0,13rem)]",
        )}
      >
        {!directoryOwned && (
          <Field label={t.crmLeads.create.honorificTitle} error={errors[`${path}.honorificTitle`]}>
            <Select
              value={honorific?.key}
              disabled={disabled}
              onValueChange={(key) =>
                onFieldChange({
                  // The LABEL, not the key: `honorificTitle` is free text on the
                  // wire and every screen prints it back as it was saved.
                  honorificTitle: honorifics.find((option) => option.key === key)?.label ?? "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t.crmLeads.create.honorificTitle} />
              </SelectTrigger>
              <SelectContent>
                {honorifics.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* A person from the directory keeps the single, read-only name the
            directory holds. A new one is typed as two parts, which is what the
            record actually stores — the rendered name is CRM's to compose. */}
        {directoryOwned ? (
          <Field label={directoryNameLabel} readOnly hint={identityHint}>
            <Input value={contact.fullName} disabled />
          </Field>
        ) : (
          <>
            <Field
              label={t.crmLeads.create.firstName}
              error={errors[`${path}.firstName`]}
              required
              hint={identityHint}
            >
              <Input
                value={contact.firstName}
                maxLength={limits.name}
                disabled={disabled}
                onChange={(event) => onFieldChange({ firstName: event.target.value })}
                onBlur={() => onBlur(`${path}.firstName`)}
              />
            </Field>
            <Field label={t.crmLeads.create.lastName} error={errors[`${path}.lastName`]}>
              <Input
                value={contact.lastName}
                maxLength={limits.name}
                disabled={disabled}
                onChange={(event) => onFieldChange({ lastName: event.target.value })}
                onBlur={() => onBlur(`${path}.lastName`)}
              />
            </Field>
          </>
        )}

        {showJobTitle && (
        <Field label={t.crmLeads.create.contactJobTitle} error={errors[`${path}.jobTitle`]}>
          <CrmJobTitleField
            value={contact.jobTitle}
            disabled={disabled}
            onChange={(next) => onFieldChange({ jobTitle: next })}
            onBlur={() => onBlur(`${path}.jobTitle`)}
          />
        </Field>
        )}

        {!directoryOwned && (
          <Field label={t.crmLeads.phone} error={errors[`${path}.phones.0`]}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <CrmPhoneNumberInput
                  value={contact.phones[0] ?? ""}
                  maxLength={CRM_PHONE_MAX_LENGTH}
                  disabled={disabled}
                  onChange={(next) => onPhoneChange(0, next)}
                  onBlur={() => onBlur(`${path}.phones.0`)}
                />
                {onPhoneAdd && contact.phones.length < CRM_PHONE_LIST_MAX && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label={t.crmShared.addPhone}
                    data-icon-button
                    onClick={onPhoneAdd}
                    // A green disc rather than a bare glyph: adding is the one
                    // affirmative control on a line whose other icon deletes,
                    // and the two should not read alike. `size-6` keeps the
                    // disc inside the control row's height.
                    className="size-6 shrink-0 rounded-full bg-positive-600 p-0 text-white not-disabled:hover:bg-positive-700"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>

              {/* Numbers two and up stack under the first one, inside this
                  column. Laid out across the whole line they started under the
                  honorific, which is not where a reader looks for a phone. */}
              {extraPhones.map((phone, offset) => {
                const index = offset + 1;
                const rowPath = `${path}.phones.${index}`;
                return (
                  <div key={rowPath} className="flex items-center gap-1">
                    <CrmPhoneNumberInput
                      value={phone}
                      maxLength={CRM_PHONE_MAX_LENGTH}
                      disabled={disabled}
                      onChange={(next) => onPhoneChange(index, next)}
                      onBlur={() => onBlur(rowPath)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      aria-label={formatTemplate(t.crmShared.removePhone, { number: index + 1 })}
                      data-icon-button
                      onClick={() => onPhoneRemove?.(index)}
                      className="size-6 shrink-0 rounded-full p-0"
                    >
                      <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </Field>
        )}

        {!directoryOwned && (
          <Field label={t.crmLeads.email} error={errors[`${path}.email`]}>
            <Input
              type="email"
              dir="ltr"
              value={contact.email}
              maxLength={limits.email}
              disabled={disabled}
              onChange={(event) => onFieldChange({ email: event.target.value })}
              onBlur={() => onBlur(`${path}.email`)}
            />
          </Field>
        )}
      </div>
    </div>
  );
}
