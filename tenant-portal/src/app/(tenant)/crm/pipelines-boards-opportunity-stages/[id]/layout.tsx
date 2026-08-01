"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function PipelineDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`مسار المبيعات: ${resolvedParams.id}`}
      subtitle="مخطط المراحل والتعديل المباشر"
      basePath={`/crm/pipelines-boards-opportunity-stages/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
