"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function CatalogueDetailLayout({
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
      title={`الكتالوج المرجعي: ${resolvedParams.id}`}
      subtitle={t.crm.manageOptionsSubmenusAndL}
      basePath={`/crm/static-data-catalogue/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
