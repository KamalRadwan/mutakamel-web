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
import { AddressPlaceFields } from "@/components/address/AddressPlaceFields";
import { useI18n } from "@/i18n/I18nContext";
import {
  ADDRESS_PLACE_MAX,
  ADDRESS_TYPES,
  type PartyAddress,
} from "../../directory-children-contract";
import {
  EMPTY_ADDRESS_FORM,
  toAddressForm,
  type AddressFormValues,
} from "../../party-child-forms";

type TextKey = Exclude<keyof AddressFormValues, "addressType" | "isPrimary">;

// `country`, `area` and `city` are absent: they are the one cascading address
// template, rendered between the label and the street below.
const TEXT_FIELDS: TextKey[] = [
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

        <Field label={copy.addressFields.label}>
          <Input
            value={values.label}
            onChange={(event) =>
              setValues((current) => ({ ...current, label: event.target.value }))
            }
            disabled={isSubmitting}
          />
        </Field>

        <AddressPlaceFields
          values={{ country: values.country, state: values.area, city: values.city }}
          labels={{
            country: copy.addressFields.country,
            state: copy.addressFields.area,
            city: copy.addressFields.city,
          }}
          maxLength={ADDRESS_PLACE_MAX}
          disabled={isSubmitting}
          onChange={(patch) =>
            setValues((current) => ({
              ...current,
              ...(patch.country === undefined ? {} : { country: patch.country }),
              // A party address calls its state-or-governorate column `area`;
              // the template's own name for that level is `state`.
              ...(patch.state === undefined ? {} : { area: patch.state }),
              ...(patch.city === undefined ? {} : { city: patch.city }),
            }))
          }
        />

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
