"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function CurrencyDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`العملة / الترقيم: ${resolvedParams.id}`}
      subtitle="إدارة أسعار الصرف، وقواعد الضريبة، والترقيم المباشر"
      basePath={`/core/currencies-taxes-numbering/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
