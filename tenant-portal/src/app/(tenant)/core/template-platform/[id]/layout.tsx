"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function TemplateDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`القالب: ${resolvedParams.id}`}
      subtitle="محرر القوالب والتعديل المباشر لمعاينة HTML/PDF"
      basePath={`/core/template-platform/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
