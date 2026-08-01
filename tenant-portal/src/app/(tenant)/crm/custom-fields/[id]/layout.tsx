"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function CustomFieldDetailLayout({
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
      title={`الحقل المخصص: ${resolvedParams.id}`}
      subtitle={t.crm.optionsManagementAndDirect}
      basePath={`/crm/custom-fields/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
