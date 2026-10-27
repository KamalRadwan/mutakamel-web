"use client";

import { useI18n } from "@/i18n/I18nContext";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import type { CustomerBoardQuickAddProps } from "./customer-board-types";
import type { useCustomerBoardQuickAdd } from "./useCustomerBoardQuickAdd";
import { CustomerBoardQuickAddNames } from "./CustomerBoardQuickAddNames";
import { CustomerBoardQuickAddSource } from "./CustomerBoardQuickAddSource";

export function CustomerBoardQuickAddIndividual({ sources, form }: {
  sources: CustomerBoardQuickAddProps["sources"]; form: ReturnType<typeof useCustomerBoardQuickAdd>;
}) {
  const { t } = useI18n();
  return (
    <>
      <CustomerBoardQuickAddNames form={form} />
      <CustomerBoardQuickAddSource sources={sources} form={form} />
      <CrmPhoneListField label={t.crmLeads.create.phoneNumber} {...form.phoneField("individualPhones")} />
    </>
  );
}
