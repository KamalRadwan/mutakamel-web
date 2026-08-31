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
  CONTACT_LABEL_MAX,
  CONTACT_METHOD_TYPES,
  CONTACT_VALUE_MAX,
  type PartyContactMethod,
} from "../../directory-children-contract";
import {
  EMPTY_CONTACT_METHOD_FORM,
  toContactMethodForm,
  type ContactMethodFormValues,
} from "../../party-child-forms";

interface ContactMethodDrawerProps {
  /** `null` opens the create form; a method opens the edit form. */
  method: PartyContactMethod | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ContactMethodFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function ContactMethodDrawer({
  method,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: ContactMethodDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const initial = method ? toContactMethodForm(method) : EMPTY_CONTACT_METHOD_FORM;
  const [values, setValues] = useState<ContactMethodFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={method ? copy.contactEditTitle : copy.contactCreateTitle}
      description={copy.contactDescription}
      isDirty={isDirty}
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
        <Field label={copy.contactType} required>
          <Select
            value={values.methodType}
            onValueChange={(value) =>
              setValues((current) => ({
                ...current,
                methodType: value as ContactMethodFormValues["methodType"],
              }))
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_METHOD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {copy.contactTypes[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={copy.contactValue} required>
          <Input
            dir="ltr"
            value={values.value}
            onChange={(event) =>
              setValues((current) => ({ ...current, value: event.target.value }))
            }
            maxLength={CONTACT_VALUE_MAX}
            disabled={isSubmitting}
            required
          />
        </Field>

        <Field label={copy.contactLabel}>
          <Input
            value={values.label}
            onChange={(event) =>
              setValues((current) => ({ ...current, label: event.target.value }))
            }
            maxLength={CONTACT_LABEL_MAX}
            disabled={isSubmitting}
          />
        </Field>

        <Field label={copy.contactPrimary} hint={copy.contactPrimaryHint}>
          <Switch
            checked={values.isPrimary}
            onCheckedChange={(checked) =>
              setValues((current) => ({ ...current, isPrimary: checked }))
            }
            disabled={isSubmitting}
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
