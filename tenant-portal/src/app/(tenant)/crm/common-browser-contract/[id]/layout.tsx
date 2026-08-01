"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function ContractDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
    const { t } = useI18n();
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`قاعدة العقد: ${resolvedParams.id}`}
      subtitle={t.crm.detailsOfTheNodalRuleAnd}
      basePath={`/crm/common-browser-contract/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
