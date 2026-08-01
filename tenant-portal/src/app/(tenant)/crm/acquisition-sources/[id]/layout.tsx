"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function SourceDetailLayout({
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
      title={`مصدر الاستقطاب: ${resolvedParams.id}`}
      subtitle={t.crm.channelDataManagementAndLi}
      basePath={`/crm/acquisition-sources/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
