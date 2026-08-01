"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function CrmSettingDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`إعداد الـ CRM: ${resolvedParams.id}`}
      subtitle="تفاصيل المتغيرات والتعديل المباشر"
      basePath={`/crm/settings/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
