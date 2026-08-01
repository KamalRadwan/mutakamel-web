"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function SourceDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`مصدر الاستقطاب: ${resolvedParams.id}`}
      subtitle="إدارة بيانات القناة وتحليل التحويل المباشر"
      basePath={`/crm/acquisition-sources/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
