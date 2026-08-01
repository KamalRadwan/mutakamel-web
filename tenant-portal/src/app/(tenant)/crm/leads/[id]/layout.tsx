"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function LeadDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`العميل المحتمل: ${resolvedParams.id}`}
      subtitle="إدارة بيانات التأهيل والترقية التلقائية إلى صفقة"
      basePath={`/crm/leads/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
