"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function CustomerDetailLayout({
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
      title={`ملف العميل: ${resolvedParams.id}`}
      subtitle={t.crm.fullCardReviewAndLiveUpda}
      basePath={`/crm/customer-profiles/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
