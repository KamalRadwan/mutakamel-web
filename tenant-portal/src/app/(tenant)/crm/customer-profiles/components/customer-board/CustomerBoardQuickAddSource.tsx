"use client";

import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import type { CustomerBoardQuickAddProps } from "./customer-board-types";
import type { useCustomerBoardQuickAdd } from "./useCustomerBoardQuickAdd";

export function CustomerBoardQuickAddSource({ sources, form }: {
  sources: CustomerBoardQuickAddProps["sources"]; form: ReturnType<typeof useCustomerBoardQuickAdd>;
}) {
  const { t, lang } = useI18n();
  return (
    <Field label={t.crmLeads.source} required={sources.length > 0} error={form.errors.acquisitionSourceId}>
      <Select value={form.sourceId || undefined} onValueChange={form.selectSource}>
        <SelectTrigger size="sm"><SelectValue placeholder={t.crmLeads.create.selectSourcePlaceholder} /></SelectTrigger>
        <SelectContent>
          {sources.map((source) => <SelectItem key={source.id} value={source.id}>
            <AcquisitionSourceOption source={source} label={localizedName(source, lang)} />
          </SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}
