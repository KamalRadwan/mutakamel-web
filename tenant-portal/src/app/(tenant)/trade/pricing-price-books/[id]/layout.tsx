"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function PriceBookDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`قائمة الأسعار: ${resolvedParams.id}`}
      subtitle="تفاصيل الخصومات وتحديث المنتجات المباشر"
      basePath={`/trade/pricing-price-books/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
