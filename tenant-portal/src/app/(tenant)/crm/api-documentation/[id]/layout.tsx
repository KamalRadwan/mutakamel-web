"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function ApiDocDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`عقد الواجهة: ${resolvedParams.id}`}
      subtitle="تفاصيل مواصفات API والتحقق المباشر من شكل الاستجابة"
      basePath={`/crm/api-documentation/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
