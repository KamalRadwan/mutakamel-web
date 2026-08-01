"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function OrderDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`أمر / عرض المبيعات: ${resolvedParams.id}`}
      subtitle="تفاصيل الأوان والخصومات والتحديث المباشر"
      basePath={`/trade/quotations-sales-orders/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
