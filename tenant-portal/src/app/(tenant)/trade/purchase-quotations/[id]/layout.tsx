"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function QuotationDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`عرض السعر RFQ: ${resolvedParams.id}`}
      subtitle="تفاصيل الأسعار والضمان والتحديث المباشر"
      basePath={`/trade/purchase-quotations/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
