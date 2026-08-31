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
import { ADDRESS_TYPES, type PartyAddress } from "../../directory-children-contract";
import {
  EMPTY_ADDRESS_FORM,
  toAddressForm,
  type AddressFormValues,
} from "../../party-child-forms";

type TextKey = Exclude<keyof AddressFormValues, "addressType" | "isPrimary">;

const TEXT_FIELDS: TextKey[] = [
  "label",
  "country",
  "city",
  "area",
  "street",
  "buildingNo",
  "floor",
  "apartment",
  "landmark",
  "postalCode",
];

interface AddressDrawerProps {
  address: PartyAddress | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: AddressFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function AddressDrawer({
  address,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: AddressDrawerProps) {
  const { t } = useI18n();
  const copy = t.coreOperations.directory;
  const initial = address ? toAddressForm(address) : EMPTY_ADDRESS_FORM;
  const [values, setValues] = useState<AddressFormValues>(initial);
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={address ? copy.addressEditTitle : copy.addressCreateTitle}
      description={copy.addressDescription}
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
        <Field label={copy.addressType} required>
          <Select
            value={values.addressType}
            onValueChange={(value) =>
              setValues((current) => ({
                ...current,
                addressType: value as AddressFormValues["addressType"],
              }))
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADDRESS_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {copy.addressTypes[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {TEXT_FIELDS.map((key) => (
          <Field key={key} label={copy.addressFields[key]}>
            <Input
              value={values[key]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [key]: event.target.value }))
              }
              disabled={isSubmitting}
            />
          </Field>
        ))}

        <Field label={copy.addressPrimary} hint={copy.addressPrimaryHint}>
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
