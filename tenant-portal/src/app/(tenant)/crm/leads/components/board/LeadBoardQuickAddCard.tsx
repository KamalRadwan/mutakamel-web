"use client";

import { Button, ToggleGroup, ToggleGroupItem } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { useBoardQuickAdd, type BoardQuickAddOptions } from "../../hooks/useBoardQuickAdd";
import { CRM_PROFILE_TYPES } from "../../lead-contract";
import { LeadBoardRating } from "./LeadBoardRating";
import {
  QuickAddCompanyField,
  QuickAddCompanyNameField,
  QuickAddNameFields,
  QuickAddPhoneField,
  QuickAddSourceField,
} from "./LeadBoardQuickAddFields";

interface LeadBoardQuickAddCardProps extends BoardQuickAddOptions {
  stageLabel: string;
  onCancel: () => void;
}

/**
 * Creates a lead straight into this column with the few fields a first call
 * yields. Anything more opens the full form, carrying what was typed.
 */
export function LeadBoardQuickAddCard({ stageLabel, onCancel, ...options }: LeadBoardQuickAddCardProps) {
  const { t } = useI18n();
  const copy = t.crmLeadBoard.quickAdd;
  const quickAdd = useBoardQuickAdd(options);
  const { values } = quickAdd;
  const isCorporate = values.leadProfileType === "CORPORATE";

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void quickAdd.submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="flex flex-col gap-2 rounded-md border border-border bg-background p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-foreground">
          {formatTemplate(copy.title, { stage: stageLabel })}
        </span>
        <Button type="button" variant="link" size="xs" onClick={quickAdd.openFullModal}>
          {copy.openFullForm}
        </Button>
      </div>

      <ToggleGroup
        type="single"
        size="xs"
        value={values.leadProfileType}
        onValueChange={(next) => {
          const type = CRM_PROFILE_TYPES.find((candidate) => candidate === next);
          if (type) quickAdd.setProfileType(type);
        }}
        aria-label={t.crmLeads.create.leadType}
        className="grid grid-cols-2"
      >
        {CRM_PROFILE_TYPES.map((type) => (
          <ToggleGroupItem key={type} value={type}>
            {t.crmLeads.create.types[type]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {!isCorporate && (
        <>
          <QuickAddNameFields quickAdd={quickAdd} first="firstName" last="lastName" isLastRequired />
          <QuickAddSourceField quickAdd={quickAdd} />
          <QuickAddPhoneField quickAdd={quickAdd} list="phones" label={t.crmLeads.create.phoneNumber} />
        </>
      )}
      {isCorporate && (
        <>
          <QuickAddCompanyField quickAdd={quickAdd} />
          {!values.existingCompanyPartyId && (
            <QuickAddCompanyNameField quickAdd={quickAdd} />
          )}
          <QuickAddSourceField quickAdd={quickAdd} />
          {!values.existingCompanyPartyId && (
            <QuickAddPhoneField quickAdd={quickAdd} list="companyPhones" label={t.crmLeads.create.companyPhones} />
          )}
          <QuickAddNameFields
            quickAdd={quickAdd}
            first="contactFirstName"
            last="contactLastName"
            isLastRequired={false}
          />
          <QuickAddPhoneField quickAdd={quickAdd} list="contactPhones" label={copy.contactPhones} />
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        <LeadBoardRating value={values.rating} onChange={quickAdd.setRating} />
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={onCancel} disabled={quickAdd.isSubmitting}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="secondary" size="xs" loading={quickAdd.isSubmitting}>
            {t.crmLeads.addLead}
          </Button>
        </div>
      </div>
    </form>
  );
}
