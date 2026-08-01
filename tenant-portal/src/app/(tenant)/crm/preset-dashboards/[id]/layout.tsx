"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function PresetDetailLayout({
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
      title={`اللوحة المسبقة: ${resolvedParams.id}`}
      subtitle={t.crm.modifyingWidgetsScreenDist}
      basePath={`/crm/dashboard/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
