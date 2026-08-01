"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function ContractDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`قاعدة العقد: ${resolvedParams.id}`}
      subtitle="تفاصيل القاعدة العقدية والتعديل المباشر"
      basePath={`/crm/common-browser-contract/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
