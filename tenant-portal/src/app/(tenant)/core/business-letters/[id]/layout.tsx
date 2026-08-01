"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function BusinessLetterDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الخطاب الرسمي: ${resolvedParams.id}`}
      subtitle="صياغة المحتوى والطباعة ومعاينة PDF المباشرة"
      basePath={`/core/business-letters/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
