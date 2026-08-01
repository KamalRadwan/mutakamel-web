"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function BillingInvoiceDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الفاتورة: ${resolvedParams.id}`}
      subtitle="معاينة تفاصيل الفوترة والدفع المباشر"
      basePath={`/core/billing-invoices-subscription/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
