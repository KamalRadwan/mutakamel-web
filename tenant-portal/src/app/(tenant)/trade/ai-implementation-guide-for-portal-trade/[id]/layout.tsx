"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function TradeAiDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`دليل الذكاء الاصطناعي: ${resolvedParams.id}`}
      subtitle="تفاصيل الـ Prompt وتجربة الاستجابة والتحديث المباشر"
      basePath={`/trade/ai-implementation-guide-for-portal-trade/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
