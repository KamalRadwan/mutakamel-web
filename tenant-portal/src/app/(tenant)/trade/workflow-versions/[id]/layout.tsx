"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function WorkflowVersionDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`إصدار مسار العمل: ${resolvedParams.id}`}
      subtitle="تفاصيل خطوات الاعتماد والتحديث المباشر"
      basePath={`/trade/workflow-versions/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
