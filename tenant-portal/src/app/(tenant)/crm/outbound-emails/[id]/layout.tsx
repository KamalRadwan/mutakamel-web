"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function OutboundEmailDetailLayout({
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
      title={`البريد الصادر: ${resolvedParams.id}`}
      subtitle={t.crm.viewMessageAndLiveUpdate}
      basePath={`/crm/outbound-emails/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
