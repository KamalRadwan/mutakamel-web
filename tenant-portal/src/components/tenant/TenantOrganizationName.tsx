"use client";

import { useTenantBranchLabels, useTenantCompanyLabels } from "@/hooks/useTenantBranchLabels";
import { useI18n } from "@/i18n/I18nContext";

export function TenantOrganizationName({ kind, id }: { kind: "company" | "branch"; id: string }) {
  const { t } = useI18n();
  const companies = useTenantCompanyLabels(kind === "company");
  const branches = useTenantBranchLabels(kind === "branch");
  return <bdi className="font-sans text-caption font-normal">{(kind === "company" ? companies : branches).get(id) ?? t.common.nameUnavailable}</bdi>;
}
