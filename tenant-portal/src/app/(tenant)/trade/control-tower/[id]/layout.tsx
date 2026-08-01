"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function ControlTowerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`مؤشر برج المراقبة: ${resolvedParams.id}`}
      subtitle="تفاصيل العتبة الحرج والتعديل المباشر"
      basePath={`/trade/control-tower/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
