"use client";

import {
  Combobox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import { CrmPhoneListField } from "../../../shared/components/CrmPhoneListField";
import type { BoardQuickAdd } from "../../hooks/useBoardQuickAdd";
import { LEAD_CREATE_LIMITS } from "../../lead-create-contract";
import type { BoardQuickAddPhoneList, BoardQuickAddTextField } from "./board-quick-add";

/** Sentinel for "create a new company" — a picker row needs a value. */
const NEW_COMPANY_VALUE = "__new__";

interface QuickAddFieldProps {
  quickAdd: BoardQuickAdd;
}

export function QuickAddNameFields({
  quickAdd,
  first,
  last,
  isLastRequired,
}: QuickAddFieldProps & { first: BoardQuickAddTextField; last: BoardQuickAddTextField; isLastRequired: boolean }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={t.crmLeads.create.firstName} required error={quickAdd.errors[first]}>
        <Input
          size="sm"
          value={quickAdd.values[first]}
          maxLength={LEAD_CREATE_LIMITS.firstName}
          onChange={(event) => quickAdd.setText(first, event.target.value)}
        />
      </Field>
      <Field label={t.crmLeads.create.lastName} required={isLastRequired} error={quickAdd.errors[last]}>
        <Input
          size="sm"
          value={quickAdd.values[last]}
          maxLength={LEAD_CREATE_LIMITS.lastName}
          onChange={(event) => quickAdd.setText(last, event.target.value)}
        />
      </Field>
    </div>
  );
}

export function QuickAddPhoneField({
  quickAdd,
  list,
  label,
}: QuickAddFieldProps & { list: BoardQuickAddPhoneList; label: string }) {
  return (
    <CrmPhoneListField
      label={label}
      phones={quickAdd.values[list]}
      path={list}
      errors={quickAdd.errors}
      disabled={quickAdd.isSubmitting}
      onChange={(index, value) => quickAdd.changePhone(list, index, value)}
      onAdd={() => quickAdd.addPhone(list)}
      onRemove={(index) => quickAdd.removePhone(list, index)}
      // Validated on save, like the rest of the card; no field checks on blur.
      onBlur={() => undefined}
    />
  );
}

export function QuickAddSourceField({ quickAdd }: QuickAddFieldProps) {
  const { t, lang } = useI18n();
  return (
    <Field label={t.crmLeads.source} required error={quickAdd.errors.acquisitionSourceId}>
      <Select value={quickAdd.sourceId || undefined} onValueChange={quickAdd.setSource}>
        <SelectTrigger size="sm">
          <SelectValue placeholder={t.crmLeads.create.selectSourcePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {quickAdd.sources.map((source) => (
            <SelectItem key={source.id} value={source.id}>
              <AcquisitionSourceOption source={source} label={localizedName(source, lang)} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function QuickAddCompanyNameField({ quickAdd }: QuickAddFieldProps) {
  const { t } = useI18n();
  return (
    <Field label={t.crmLeads.companyName} required error={quickAdd.errors.companyName}>
      <Input
        size="sm"
        value={quickAdd.values.companyName}
        maxLength={LEAD_CREATE_LIMITS.companyName}
        onChange={(event) => quickAdd.setText("companyName", event.target.value)}
      />
    </Field>
  );
}

/** The company: an existing Directory organization, or "create a new company" pinned first. */
export function QuickAddCompanyField({ quickAdd }: QuickAddFieldProps) {
  const { t } = useI18n();
  const existingId = quickAdd.values.existingCompanyPartyId;
  return (
    <Field label={t.crmLeads.create.sections.company} required>
      <Combobox
        size="sm"
        options={[{ value: NEW_COMPANY_VALUE, label: t.crmLeads.newCompany }, ...quickAdd.companyOptions]}
        value={existingId || NEW_COMPANY_VALUE}
        selectedLabel={quickAdd.existingCompanyName || t.crmLeads.newCompany}
        onValueChange={(id) => quickAdd.selectCompany(id === NEW_COMPANY_VALUE ? "" : id ?? "")}
        onSearch={quickAdd.setCompanyQuery}
        debounceMs={0}
        loading={quickAdd.isLoadingCompanies}
        loadingLabel={t.common.loading}
        placeholder={t.crmLeadBoard.quickAdd.selectCompany}
        searchPlaceholder={t.crmShared.searchCompanies}
        emptyLabel={t.crmShared.noMatchingCompanies}
      />
    </Field>
  );
}
