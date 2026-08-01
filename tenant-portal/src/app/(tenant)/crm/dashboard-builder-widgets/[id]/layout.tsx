"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function WidgetDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`عنصر التحليل: ${resolvedParams.id}`}
      subtitle="تعديل أبعاد الـ Widget والتحديث المباشر"
      basePath={`/crm/dashboard-builder-widgets/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
