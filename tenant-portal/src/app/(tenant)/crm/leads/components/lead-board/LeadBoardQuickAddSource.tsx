"use client";

import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { localizedName } from "@/lib/format/localized";
import { AcquisitionSourceOption } from "../../../shared/components/AcquisitionSourceIcon";
import type { useLeadBoardQuickAdd } from "./useLeadBoardQuickAdd";

type Form = ReturnType<typeof useLeadBoardQuickAdd>;

export function LeadBoardQuickAddSource({ form }: { form: Form }) {
  const { t, lang, sources, sourceId, errors, changeText } = form;
  return (
    <Field
      label={t.crmLeads.source}
      required
      error={errors.acquisitionSourceId}
    >
      <Select
        value={sourceId || undefined}
        onValueChange={(value) => changeText("acquisitionSourceId", value)}
      >
        <SelectTrigger size="sm">
          <SelectValue placeholder={t.crmLeads.create.selectSourcePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {sources.map((src) => (
            <SelectItem key={src.id} value={src.id}>
              <AcquisitionSourceOption
                source={src}
                label={localizedName(src, lang)}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
