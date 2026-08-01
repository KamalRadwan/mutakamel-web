"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function PdfJobDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`مهمة رندر الـ PDF: ${resolvedParams.id}`}
      subtitle="استعراض خيارات الطباعة والتحديث المباشر"
      basePath={`/trade/business-document-pdf-render-jobs/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
