"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function ApiDocDetailLayout({
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
      title={`عقد الواجهة: ${resolvedParams.id}`}
      subtitle={t.crm.aPISpecificationDetailsAnd}
      basePath={`/crm/api-documentation/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
