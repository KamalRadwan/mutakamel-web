"use client";

import { useState } from "react";
import { Button, Combobox, Field, NameSelect, type ComboboxOption } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import type { InquirySelection } from "./contract";
import { useInquiryLeadSearch } from "./useInquiryLeadSearch";

export function InquiryPicker({ branches, value, onChange, reference, disabled, excludeId }: {
  branches: ComboboxOption[];
  value: InquirySelection | null;
  onChange: (value: InquirySelection | null) => void;
  reference?: boolean;
  disabled: boolean;
  excludeId?: string;
}) {
  const { t } = useI18n();
  const copy = t.crmDashboardReports.inquiryReview;
  const [branch, setBranch] = useState("");
  const branchId = branch || value?.branchId || branches[0]?.value || "";
  return <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
    <Field label={reference ? copy.referenceBranch : copy.sourceBranch} showLabel>
      <NameSelect value={branchId || undefined} options={branches} placeholder={t.common.selectBranch}
        disabled={disabled || branches.length < 2} onValueChange={next => {
          setBranch(next);
          onChange(null);
        }} />
    </Field>
    <LeadPicker key={branchId} branchId={branchId} value={value} onChange={onChange}
      label={reference ? copy.reference : copy.source} disabled={disabled || !branchId} excludeId={excludeId} />
  </div>;
}

function LeadPicker({ branchId, value, onChange, label, disabled, excludeId }: {
  branchId: string;
  value: InquirySelection | null;
  onChange: (value: InquirySelection | null) => void;
  label: string;
  disabled: boolean;
  excludeId?: string;
}) {
  const { t, lang } = useI18n();
  const copy = t.crmDashboardReports.inquiryReview;
  const search = useInquiryLeadSearch(branchId);
  const items = search.items.filter(item => item.id !== excludeId);
  return <Field label={label} showLabel>
    <Combobox value={value?.id} selectedLabel={value?.name || t.common.nameUnavailable}
      options={items.map(item => ({ value: item.id, label: item.name || t.common.nameUnavailable,
        description: item.createdAt ? formatDateTime(item.createdAt, lang) : undefined }))}
      onValueChange={id => onChange(items.find(item => item.id === id) ?? null)}
      onSearch={search.search} loading={search.loading} disabled={disabled} clearLabel={copy.clear}
      placeholder={copy.chooseLead} searchPlaceholder={copy.searchLead} loadingLabel={t.common.loading}
      emptyLabel={copy.noLeads} wrapLabels
      errorContent={search.error && <div role="alert" className="flex flex-wrap items-center gap-2 p-2 text-sm">
        {copy.searchFailed}<Button size="sm" variant="outline" onClick={search.retry}>{t.common.retry}</Button>
      </div>}
      footer={!search.loading && !search.error && (search.hasPrevious || search.hasNext) && <div className="flex justify-between gap-2 p-2">
        <Button size="sm" variant="outline" disabled={!search.hasPrevious} onClick={() => search.move(-1)}>{copy.previousPage}</Button>
        <Button size="sm" variant="outline" disabled={!search.hasNext} onClick={() => search.move(1)}>{copy.nextPage}</Button>
      </div>} />
  </Field>;
}
