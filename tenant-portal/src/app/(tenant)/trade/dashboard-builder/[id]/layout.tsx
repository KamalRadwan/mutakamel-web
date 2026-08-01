"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function TradeDashboardDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`اللوحة التجارية: ${resolvedParams.id}`}
      subtitle="تعديل المكونات والشبكة والتحديث المباشر"
      basePath={`/trade/dashboard-builder/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
