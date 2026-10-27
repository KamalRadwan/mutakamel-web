"use client";

import { Field, Input } from "@/design-system";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import { LEAD_CREATE_LIMITS } from "../../lead-create-contract";
import type { useLeadBoardQuickAdd } from "./useLeadBoardQuickAdd";
import { LeadBoardQuickAddSource } from "./LeadBoardQuickAddSource";

type Form = ReturnType<typeof useLeadBoardQuickAdd>;

export function LeadBoardQuickAddIndividual({ form }: { form: Form }) {
  const {
    t,
    firstName,
    lastName,
    individualPhones,
    errors,
    isSubmitting,
    changeText,
    changePhone,
    addPhone,
    removePhone,
    handlePhoneBlur,
    handleKeyDown,
  } = form;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label={t.crmLeads.create.firstName}
          required
          error={errors.firstName}
        >
          <Input
            size="sm"
            value={firstName}
            maxLength={LEAD_CREATE_LIMITS.firstName}
            onChange={(event) => changeText("firstName", event.target.value)}
            placeholder={t.crmLeads.executive.firstName}
            onKeyDown={handleKeyDown}
          />
        </Field>
        <Field
          label={t.crmLeads.create.lastName}
          error={errors.lastName}
        >
          <Input
            size="sm"
            value={lastName}
            maxLength={LEAD_CREATE_LIMITS.lastName}
            onChange={(event) => changeText("lastName", event.target.value)}
            placeholder={t.crmLeads.executive.lastName}
            onKeyDown={handleKeyDown}
          />
        </Field>
      </div>

      <LeadBoardQuickAddSource form={form} />

      <CrmPhoneListField
        label={t.crmLeads.create.phoneNumber}
        phones={individualPhones}
        path="phones"
        errors={errors}
        disabled={isSubmitting}
        onChange={(index, value) => changePhone("phones", index, value)}
        onAdd={() => addPhone("phones")}
        onRemove={(index) => removePhone("phones", index)}
        onBlur={handlePhoneBlur}
      />
    </>
  );
}
