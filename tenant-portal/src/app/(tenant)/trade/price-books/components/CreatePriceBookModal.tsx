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
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  EMPTY_PRICE_BOOK_FORM,
  PRICE_BOOK_CODE_MAX_LENGTH,
  PRICE_BOOK_PURPOSES,
  type PriceBookFormValues,
} from "../pricing-contract";

interface CreatePriceBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PriceBookFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreatePriceBookModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreatePriceBookModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<PriceBookFormValues>(EMPTY_PRICE_BOOK_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_PRICE_BOOK_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_PRICE_BOOK_FORM);
          onClose();
        }
      }}
      title={t.tradePricing.bookCreateTitle}
      description={t.tradePricing.bookCreateDescription}
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
      <div className="flex flex-col gap-3">
        <Field label={t.tradePricing.bookCode} required>
          <Input
            value={values.code}
            maxLength={PRICE_BOOK_CODE_MAX_LENGTH}
            disabled={isSubmitting}
            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
          />
        </Field>
        <Field label={t.tradePricing.bookPurpose} required>
          <Select
            value={values.purpose}
            disabled={isSubmitting}
            onValueChange={(next) =>
              setValues((current) => ({
                ...current,
                purpose: next as PriceBookFormValues["purpose"],
              }))
            }
          >
            <SelectTrigger aria-label={t.tradePricing.bookPurpose}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_BOOK_PURPOSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {tradeStatusLabel(t.tradeStatus, value, t.common.unknownCode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={t.tradePricing.currencyCode}
          required
          hint={t.tradePricing.currencyCodeHint}
        >
          <Input
            value={values.currencyCode}
            maxLength={3}
            disabled={isSubmitting}
            onChange={(event) =>
              setValues((current) => ({ ...current, currencyCode: event.target.value }))
            }
          />
        </Field>
      </div>
    </FormDrawer>
  );
}
