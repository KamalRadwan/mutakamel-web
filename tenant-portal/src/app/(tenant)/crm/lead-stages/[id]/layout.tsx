"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function LeadStageDetailLayout({
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
      title={`مرحلة المبيعات: ${resolvedParams.id}`}
      subtitle={t.crm.modifyingConditionsClosing}
      basePath={`/crm/lead-stages/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
