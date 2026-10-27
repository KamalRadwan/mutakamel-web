"use client";

import { Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { CUSTOMER_PROFILE_CREATE_LIMITS } from "../../customer-profile-create-contract";
import type { useCustomerBoardQuickAdd } from "./useCustomerBoardQuickAdd";

export function CustomerBoardQuickAddNames({ form, contact = false }: {
  form: ReturnType<typeof useCustomerBoardQuickAdd>; contact?: boolean;
}) {
  const { t } = useI18n();
  const firstKey = contact ? "contactFirstName" : "firstName";
  const lastKey = contact ? "contactLastName" : "lastName";
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={t.crmLeads.create.firstName} required error={form.errors[firstKey]}>
        <Input size="sm" {...form.textField(firstKey)} maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.firstName}
          placeholder={t.crmCustomerProfiles.ui.board.first_name} />
      </Field>
      <Field label={t.crmLeads.create.lastName} required={!contact} error={form.errors[lastKey]}>
        <Input size="sm" {...form.textField(lastKey)} maxLength={CUSTOMER_PROFILE_CREATE_LIMITS.lastName}
          placeholder={t.crmCustomerProfiles.ui.board.last_name} />
      </Field>
    </div>
  );
}
