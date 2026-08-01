"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function InvoiceDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`المستند التجاري: ${resolvedParams.id}`}
      subtitle="تفاصيل المبالغ وقواعد الزكاة والتحديث المباشر"
      basePath={`/trade/invoices-contracts/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
