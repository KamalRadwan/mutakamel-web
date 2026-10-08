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
  /** When true, renders visible labels above the controls. */
  showLabels?: boolean;
  /** Mark lastName as required (shows red asterisk on label). */
  lastNameRequired?: boolean;
  /** Mark phone as required (shows red asterisk on label). */
  phoneRequired?: boolean;
  /**
   * Layout mode:
   * - "single-row": The default responsive line layout.
   * - "two-row": Two comfortable rows (Row 1: Title, First Name, Last Name; Row 2: Phone, Email) with more height.
   */
  layout?: "single-row" | "two-row";
  /** Optional overrides for field labels */
  fieldLabels?: {
    honorificTitle?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  };
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
  showLabels = false,
  lastNameRequired = false,
  phoneRequired = false,
  layout = "single-row",
  fieldLabels,
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

  if (layout === "two-row") {
    return (
      <div className="@container flex flex-col gap-4">
        {/* Row 1: Title (honorific), First name, Last name, (Job title if shown) */}
        <div className="grid grid-cols-1 gap-4 @min-[32rem]:grid-cols-12">
          {!directoryOwned && (
            <div className="@min-[32rem]:col-span-3 @min-[48rem]:col-span-2">
              <Field
                label={fieldLabels?.honorificTitle ?? t.crmLeads.create.honorificTitle}
                error={errors[`${path}.honorificTitle`]}
                showLabel={showLabels}
              >
                <Select
                  value={honorific?.key ?? ""}
                  disabled={disabled}
                  onValueChange={(key) =>
                    onFieldChange({
                      honorificTitle: honorifics.find((option) => option.key === key)?.label ?? "",
                    })
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder={fieldLabels?.honorificTitle ?? t.crmLeads.create.honorificTitle} />
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
            </div>
          )}

          <div
            className={cn(
              directoryOwned
                ? "@min-[32rem]:col-span-12"
                : showJobTitle
                  ? "@min-[32rem]:col-span-9 @min-[48rem]:col-span-10 grid grid-cols-1 gap-4 @min-[32rem]:grid-cols-3"
                  : "@min-[32rem]:col-span-9 @min-[48rem]:col-span-10 grid grid-cols-1 gap-4 @min-[32rem]:grid-cols-2",
            )}
          >
            {directoryOwned ? (
              <Field label={directoryNameLabel} readOnly hint={identityHint} showLabel={showLabels}>
                <Input size="sm" placeholder={directoryNameLabel} value={contact.fullName} disabled />
              </Field>
            ) : (
              <>
                <Field
                  label={fieldLabels?.firstName ?? t.crmLeads.create.firstName}
                  error={errors[`${path}.firstName`]}
                  required
                  hint={identityHint}
                  showLabel={showLabels}
                >
                  <Input
                    size="sm"
                    placeholder={fieldLabels?.firstName ?? t.crmLeads.create.firstName}
                    value={contact.firstName}
                    maxLength={limits.name}
                    disabled={disabled}
                    onChange={(event) => onFieldChange({ firstName: event.target.value })}
                    onBlur={() => onBlur(`${path}.firstName`)}
                  />
                </Field>
                <Field
                  label={fieldLabels?.lastName ?? t.crmLeads.create.lastName}
                  error={errors[`${path}.lastName`]}
                  required={lastNameRequired}
                  showLabel={showLabels}
                >
                  <Input
                    size="sm"
                    placeholder={fieldLabels?.lastName ?? t.crmLeads.create.lastName}
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
              <Field
                label={t.crmLeads.create.contactJobTitle}
                error={errors[`${path}.jobTitle`]}
                showLabel={showLabels}
              >
                <CrmJobTitleField
                  value={contact.jobTitle}
                  disabled={disabled}
                  onChange={(next) => onFieldChange({ jobTitle: next })}
                  onBlur={() => onBlur(`${path}.jobTitle`)}
                />
              </Field>
            )}
          </div>
        </div>

        {/* Row 2: Phone number, Email address */}
        <div className="grid grid-cols-1 gap-4 @min-[36rem]:grid-cols-2">
          {!directoryOwned && (
            <Field
              label={fieldLabels?.phone ?? t.crmLeads.phone}
              error={errors[`${path}.phones.0`]}
              required={phoneRequired}
              showLabel={showLabels}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <CrmPhoneNumberInput
                    value={contact.phones[0] ?? ""}
                    maxLength={CRM_PHONE_MAX_LENGTH}
                    label={fieldLabels?.phone ?? t.crmLeads.phone}
                    placeholder={t.crmShared.enterPhoneNumber ?? t.crmShared.phoneNumber}
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
                      className="size-6 shrink-0 rounded-full bg-positive-600 p-0 text-white not-disabled:hover:bg-positive-700"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>

                {extraPhones.map((phone, offset) => {
                  const index = offset + 1;
                  const rowPath = `${path}.phones.${index}`;
                  return (
                    <div key={rowPath} className="flex items-center gap-1">
                      <CrmPhoneNumberInput
                        value={phone}
                        maxLength={CRM_PHONE_MAX_LENGTH}
                        label={formatTemplate(t.crmShared.phoneNumbered, { number: index + 1 })}
                        placeholder={t.crmShared.enterPhoneNumber ?? t.crmShared.phoneNumber}
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
            <Field
              label={fieldLabels?.email ?? t.crmLeads.email}
              error={errors[`${path}.email`]}
              showLabel={showLabels}
            >
              <Input
                size="sm"
                placeholder={fieldLabels?.email ?? t.crmLeads.email}
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

  return (
    // A container, so the line answers to the width IT has rather than to the
    // width of the window. It used to go single-row at `xl`, a 1280px VIEWPORT
    // — which is a different question from "is there room for five controls
    // here". The create modal is `inset-5`, so at 1160px of screen the line had
    // roughly 900px to work with and still wrapped into two columns, because
    // the window was 120px short of a breakpoint that was never measuring this
    // element. It is also the answer to the hazard geometry.md#density-does-not
    // -move-the-breakpoints names: density scales the controls but not the
    // breakpoints, and a container query measures what density actually did.
    <div className="@container flex flex-col gap-2">
      <div
        className={cn(
          "grid grid-cols-1 gap-x-3 gap-y-3 @min-[28rem]:grid-cols-2",
          // One row as soon as one row FITS — 52rem of container without a job
          // title, 64rem with one. Calibrated column metrics keep first name and
          // last name comfortable (~175px), job title balanced (~150px), email
          // proportional (~210px), and phone protected from wrapping (~264px+).
          // Written out rather than composed: Tailwind reads these as text.
          showJobTitle
            ? "@min-[64rem]:grid-cols-[4.5rem_minmax(0,11rem)_minmax(0,11rem)_minmax(0,9.5rem)_minmax(16.5rem,1fr)_minmax(0,13rem)]"
            : "@min-[52rem]:grid-cols-[minmax(5rem,5.5rem)_minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,1.3fr)_minmax(0,1.2fr)]",
        )}
      >
        {!directoryOwned && (
          <Field
            label={fieldLabels?.honorificTitle ?? t.crmLeads.create.honorificTitle}
            error={errors[`${path}.honorificTitle`]}
            showLabel={showLabels}
          >
            <Select
              value={honorific?.key ?? ""}
              disabled={disabled}
              onValueChange={(key) =>
                onFieldChange({
                  // The LABEL, not the key: `honorificTitle` is free text on the
                  // wire and every screen prints it back as it was saved.
                  honorificTitle: honorifics.find((option) => option.key === key)?.label ?? "",
                })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder={fieldLabels?.honorificTitle ?? t.crmLeads.create.honorificTitle} />
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
          <Field label={directoryNameLabel} readOnly hint={identityHint} showLabel={showLabels}>
            <Input size="sm" placeholder={directoryNameLabel} value={contact.fullName} disabled />
          </Field>
        ) : (
          <>
            <Field
              label={fieldLabels?.firstName ?? t.crmLeads.create.firstName}
              error={errors[`${path}.firstName`]}
              required
              hint={identityHint}
              showLabel={showLabels}
            >
              <Input size="sm" placeholder={fieldLabels?.firstName ?? t.crmLeads.create.firstName}
                value={contact.firstName}
                maxLength={limits.name}
                disabled={disabled}
                onChange={(event) => onFieldChange({ firstName: event.target.value })}
                onBlur={() => onBlur(`${path}.firstName`)}
              />
            </Field>
            <Field
              label={fieldLabels?.lastName ?? t.crmLeads.create.lastName}
              error={errors[`${path}.lastName`]}
              required={lastNameRequired}
              showLabel={showLabels}
            >
              <Input size="sm" placeholder={fieldLabels?.lastName ?? t.crmLeads.create.lastName}
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
          <Field
            label={t.crmLeads.create.contactJobTitle}
            error={errors[`${path}.jobTitle`]}
            showLabel={showLabels}
          >
            <CrmJobTitleField
              value={contact.jobTitle}
              disabled={disabled}
              onChange={(next) => onFieldChange({ jobTitle: next })}
              onBlur={() => onBlur(`${path}.jobTitle`)}
            />
          </Field>
        )}

        {!directoryOwned && (
          <Field
            label={fieldLabels?.phone ?? t.crmLeads.phone}
            error={errors[`${path}.phones.0`]}
            required={phoneRequired}
            showLabel={showLabels}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <CrmPhoneNumberInput
                  value={contact.phones[0] ?? ""}
                  maxLength={CRM_PHONE_MAX_LENGTH}
                  label={fieldLabels?.phone ?? t.crmLeads.phone}
                  placeholder={t.crmShared.enterPhoneNumber ?? t.crmShared.phoneNumber}
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
                      label={formatTemplate(t.crmShared.phoneNumbered, { number: index + 1 })}
                      placeholder={t.crmShared.enterPhoneNumber ?? t.crmShared.phoneNumber}
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
          <Field
            label={fieldLabels?.email ?? t.crmLeads.email}
            error={errors[`${path}.email`]}
            showLabel={showLabels}
          >
            <Input size="sm" placeholder={fieldLabels?.email ?? t.crmLeads.email}
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
