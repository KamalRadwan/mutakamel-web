"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function LeadDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
    const { t, lang } = useI18n();
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={lang === "ar" ? `العميل المحتمل: ${resolvedParams.id}` : `Lead: ${resolvedParams.id}`}
      subtitle={t.crm.manageQualificationDataAnd}
      basePath={`/crm/leads/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
