"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function BrowserExampleDetailLayout({
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
      title={`نموذج المتصفح: ${resolvedParams.id}`}
      subtitle={t.crm.payloadEditorLiveModificat}
      basePath={`/crm/browser-examples/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
