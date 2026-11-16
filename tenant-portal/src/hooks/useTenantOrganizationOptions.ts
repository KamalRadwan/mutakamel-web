"use client";

import { useTenantBranchLabels, useTenantCompanyLabels } from "./useTenantBranchLabels";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";

export function useTenantOrganizationOptions(kind: "company" | "branch", ids: readonly string[]) {
  const { t, lang } = useI18n();
  const companies = useTenantCompanyLabels(kind === "company" && ids.length > 0);
  const branches = useTenantBranchLabels(kind === "branch" && ids.length > 0);
  const labels = kind === "company" ? companies : branches;
  const fallback = kind === "company" ? t.common.companyNameFallback : t.common.branchNameFallback;
  // `resolved` is false when the label is an ordinal placeholder, so identity surfaces can avoid showing it.
  return ids.map((value, index) => {
    const name = labels.get(value);
    return { value, label: name ?? formatTemplate(fallback, { number: formatNumber(index + 1, lang) }), resolved: name !== undefined };
  });
}
