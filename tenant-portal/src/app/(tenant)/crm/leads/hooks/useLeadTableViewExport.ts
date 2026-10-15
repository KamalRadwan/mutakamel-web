"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { csvFileName, downloadCsv, toCsv, type CsvColumn } from "@/lib/export/csv";
import { localizedName, localizedValue } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { leadCardHeading } from "../lead-card-contract";
import type { LeadItem, LeadStage } from "./useLeads";

export interface LeadSelectionExport {
  /** The selected rows this page holds — the only rows the file can contain. */
  rowCount: number;
  exportSelected: () => void;
  /** The browser could not be handed a file. */
  failed: boolean;
}

/**
 * CSV of the selected leads, built in the browser from the rows already on
 * screen: there is no lead export route (see src/lib/export/csv.ts).
 */
export function useLeadTableViewExport(
  items: readonly LeadItem[],
  stages: readonly LeadStage[],
  selectedIds: ReadonlySet<string>,
): LeadSelectionExport {
  const { t, lang } = useI18n();
  const [failed, setFailed] = useState(false);
  const rows = items.filter((item) => selectedIds.has(item.id));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));

  const columns: CsvColumn<LeadItem>[] = [
    { header: t.crmLeads.name, value: (lead) => leadCardHeading(lead).title },
    { header: t.crmLeads.create.leadType, value: (lead) => t.crmLeads.create.types[lead.leadProfileType] },
    { header: t.crmLeads.contact, value: (lead) => lead.primaryContact?.displayName ?? "" },
    { header: t.crmLeads.phone, value: (lead) => lead.phones.join("; ") },
    { header: t.crmLeads.email, value: (lead) => lead.email },
    { header: t.crmLeads.create.country, value: (lead) => lead.country },
    { header: t.crmLeads.stage, value: (lead) => localizedName(stageById.get(lead.stageId), lang) },
    { header: t.crmLeads.source, value: (lead) => localizedValue(lead.sourceNameAr, lead.sourceNameEn, lang) },
    {
      header: t.crmLeads.salesperson,
      value: (lead) => [lead.owner?.firstName, lead.owner?.lastName].filter(Boolean).join(" "),
    },
    { header: t.crmLeads.card.rating, value: (lead) => formatNumber(lead.rating, lang) },
  ];

  return {
    rowCount: rows.length,
    failed,
    exportSelected: () => {
      const written = downloadCsv(csvFileName("leads", new Date().toISOString()), toCsv(columns, rows));
      setFailed(!written);
    },
  };
}
