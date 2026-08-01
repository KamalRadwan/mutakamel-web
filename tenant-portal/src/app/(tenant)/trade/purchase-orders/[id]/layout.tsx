"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function PurchaseOrderDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`أمر الشراء: ${resolvedParams.id}`}
      subtitle="تفاصيل التوريد والاستلام والتحديث المباشر"
      basePath={`/trade/purchase-orders/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
