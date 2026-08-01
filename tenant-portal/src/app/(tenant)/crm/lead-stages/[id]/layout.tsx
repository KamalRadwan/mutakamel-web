"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function LeadStageDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`مرحلة المبيعات: ${resolvedParams.id}`}
      subtitle="تعديل الشروط ونسبة الإغلاق والتحديث المباشر"
      basePath={`/crm/lead-stages/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
