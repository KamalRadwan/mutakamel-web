"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  EMPTY_OPENING_BALANCE_FORM,
  type OpeningBalanceFormValues,
} from "../movements-contract";

interface OpeningBalanceFormProps {
  onSubmit: (values: OpeningBalanceFormValues) => Promise<boolean>;
  isPending: boolean;
  disabled: boolean;
  error: string | null;
}

export function OpeningBalanceForm({
  onSubmit,
  isPending,
  disabled,
  error,
}: OpeningBalanceFormProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<OpeningBalanceFormValues>(EMPTY_OPENING_BALANCE_FORM);
  const set = (patch: Partial<OpeningBalanceFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t.tradeInventory.openingBalanceHint}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t.tradeInventory.nodeId} required error={error ?? undefined}>
          <Input
            value={values.nodeId}
            disabled={disabled || isPending}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ nodeId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.itemId} required>
          <Input
            value={values.itemId}
            disabled={disabled || isPending}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ itemId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.uomId} required>
          <Input
            value={values.uomId}
            disabled={disabled || isPending}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) => set({ uomId: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.quantity} required hint={t.tradeCommon.decimalHint}>
          <Input
            value={values.quantity}
            disabled={disabled || isPending}
            inputMode="decimal"
            onChange={(event) => set({ quantity: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.itemProfileVersion} required>
          <Input
            type="number"
            min={1}
            value={values.itemProfileVersion}
            disabled={disabled || isPending}
            onChange={(event) => set({ itemProfileVersion: event.target.value })}
          />
        </Field>
        <Field label={t.tradeInventory.businessEffectiveAt} required>
          <Input
            type="datetime-local"
            value={values.businessEffectiveAt}
            disabled={disabled || isPending}
            onChange={(event) => set({ businessEffectiveAt: event.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={disabled}
          loading={isPending}
          onClick={() => {
            void onSubmit(values).then((saved) => {
              if (saved) setValues(EMPTY_OPENING_BALANCE_FORM);
            });
          }}
        >
          {t.tradeInventory.submitOpeningBalance}
        </Button>
      </div>
    </div>
  );
}
