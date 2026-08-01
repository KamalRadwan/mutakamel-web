"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function OpportunityDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الفرصة التجارية: ${resolvedParams.id}`}
      subtitle="تفاصيل القيمة، المرحلة والتحديث المباشر"
      basePath={`/crm/opportunities-stage-history/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
