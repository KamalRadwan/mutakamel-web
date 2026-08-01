"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function CatalogUomDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`العنصر المرجعي: ${resolvedParams.id}`}
      subtitle="تفاصيل معامل التحويل والتحديث المباشر"
      basePath={`/trade/catalog-uom-channels/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
