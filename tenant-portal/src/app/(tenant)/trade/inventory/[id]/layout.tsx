"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function InventoryDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`صنف المخزون: ${resolvedParams.id}`}
      subtitle="تفاصيل الكميات وتحديث المخزون المباشر"
      basePath={`/trade/inventory/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
