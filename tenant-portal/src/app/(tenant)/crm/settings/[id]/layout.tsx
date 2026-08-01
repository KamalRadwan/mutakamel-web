"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function CrmSettingDetailLayout({
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
      title={`إعداد الـ CRM: ${resolvedParams.id}`}
      subtitle={t.crm.detailsOfVariablesAndDirec}
      basePath={`/crm/settings/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
