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
  Textarea,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  ACCOUNT_ROLES,
  EMPTY_ACCOUNT_FORM,
  toAccountForm,
  type AccountFormValues,
  type AccountRole,
  type CommercialAccount,
} from "../commercial-account-contract";

interface AccountDrawerProps {
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<boolean>;
}

function useDrawerLabels() {
  const { t } = useI18n();
  return {
    submit: t.trade.save,
    cancel: t.common.cancel,
    discardTitle: t.common.discardTitle,
    discardDescription: t.common.discardDescription,
    discardConfirm: t.common.discardConfirm,
    discardCancel: t.common.cancel,
  };
}

function AccountFields({
  values,
  onChange,
  isSubmitting,
  isEdit,
}: {
  values: AccountFormValues;
  onChange: (patch: Partial<AccountFormValues>) => void;
  isSubmitting: boolean;
  isEdit: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <Field
        label={t.trade.accountParty}
        hint={t.trade.accountPartyHint}
        readOnly={isEdit}
        required={!isEdit}
      >
        <Input
          dir="ltr"
          className="font-mono"
          value={values.partyId}
          onChange={(event) => onChange({ partyId: event.target.value })}
          disabled={isSubmitting}
          readOnly={isEdit}
          required={!isEdit}
        />
      </Field>

      {/* `UpdateCommercialAccountDto` carries no `accountRole`: one account per
          party per role, fixed at creation. */}
      <Field label={t.trade.accountRole} readOnly={isEdit} required>
        <Select
          value={values.accountRole}
          onValueChange={(next) => onChange({ accountRole: next as AccountRole })}
          disabled={isSubmitting || isEdit}
        >
          <SelectTrigger aria-label={t.trade.accountRole} aria-readonly={isEdit}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {t.trade[`accountRole_${role}`]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t.trade.accountCreditLimit} hint={t.trade.accountCreditLimitHint}>
        <Input
          dir="ltr"
          inputMode="decimal"
          className="tabular-nums"
          value={values.creditLimit}
          onChange={(event) => onChange({ creditLimit: event.target.value })}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.accountCurrency} hint={t.trade.accountCurrencyHint}>
        <Input
          dir="ltr"
          value={values.creditCurrencyCode}
          onChange={(event) => onChange({ creditCurrencyCode: event.target.value.toUpperCase() })}
          maxLength={3}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.accountPaymentTerms}>
        <Input
          dir="ltr"
          className="font-mono"
          value={values.paymentTermsId}
          onChange={(event) => onChange({ paymentTermsId: event.target.value })}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.accountPriceBook}>
        <Input
          dir="ltr"
          className="font-mono"
          value={values.priceBookId}
          onChange={(event) => onChange({ priceBookId: event.target.value })}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.accountCreditPolicy}>
        <Input
          dir="ltr"
          className="font-mono"
          value={values.creditPolicyVersionId}
          onChange={(event) => onChange({ creditPolicyVersionId: event.target.value })}
          disabled={isSubmitting}
        />
      </Field>

      <Field label={t.trade.accountTerms} hint={t.trade.accountTermsHint}>
        <Textarea
          dir="ltr"
          className="font-mono"
          value={values.terms}
          onChange={(event) => onChange({ terms: event.target.value })}
          disabled={isSubmitting}
        />
      </Field>
    </div>
  );
}

export function CreateAccountDrawer({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: AccountDrawerProps & { isOpen: boolean }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const [values, setValues] = useState<AccountFormValues>(EMPTY_ACCOUNT_FORM);

  return (
    <FormDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_ACCOUNT_FORM);
          onClose();
        }
      }}
      title={t.trade.accountCreateTitle}
      description={t.trade.accountCreateDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(EMPTY_ACCOUNT_FORM)}
      isSubmitting={isSubmitting}
      onSubmit={() => {
        void onSubmit(values).then((saved) => {
          if (saved) setValues(EMPTY_ACCOUNT_FORM);
        });
      }}
      error={error ?? undefined}
      labels={labels}
    >
      <AccountFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit={false}
      />
    </FormDrawer>
  );
}

export function EditAccountDrawer({
  account,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: AccountDrawerProps & { account: CommercialAccount }) {
  const { t } = useI18n();
  const labels = useDrawerLabels();
  const initial = toAccountForm(account);
  const [values, setValues] = useState<AccountFormValues>(initial);

  return (
    <FormDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t.trade.accountEditTitle}
      description={t.trade.accountEditDescription}
      isDirty={JSON.stringify(values) !== JSON.stringify(initial)}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={labels}
    >
      <AccountFields
        values={values}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        isSubmitting={isSubmitting}
        isEdit
      />
    </FormDrawer>
  );
}
