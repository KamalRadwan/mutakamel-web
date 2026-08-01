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
      title={`الويدجت التجارية: ${resolvedParams.id}`}
      subtitle="تفاصيل مصدر البيانات والتحديث المباشر"
      basePath={`/trade/dashboard-widgets/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
