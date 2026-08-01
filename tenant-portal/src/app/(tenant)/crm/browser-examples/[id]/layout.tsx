"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function BrowserExampleDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`نموذج المتصفح: ${resolvedParams.id}`}
      subtitle="محرر الحمولة والتعديل المباشر واختبار الاستدعاء"
      basePath={`/crm/browser-examples/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
