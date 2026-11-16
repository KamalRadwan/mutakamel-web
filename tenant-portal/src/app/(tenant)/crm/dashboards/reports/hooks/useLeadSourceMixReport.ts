"use client";

import { useState } from "react";
import { LEAD_SOURCE_MIX_REPORT_PATH, parseLeadSourceMixReport } from "../lead-source-mix-contract";
import { useLeadCatalogueReport } from "./useLeadAcquisitionReport";

export const SOURCE_MIX_VIEWS = ["PIE", "DONUT", "BAR", "TABLE"] as const;

export function useLeadSourceMixReport() {
  const report = useLeadCatalogueReport(LEAD_SOURCE_MIX_REPORT_PATH, parseLeadSourceMixReport);
  const [view, setView] = useState<(typeof SOURCE_MIX_VIEWS)[number]>("PIE");
  return { ...report, view, changeView: (value: string) => {
    const next = SOURCE_MIX_VIEWS.find(candidate => candidate === value);
    if (next) setView(next);
  } };
}
