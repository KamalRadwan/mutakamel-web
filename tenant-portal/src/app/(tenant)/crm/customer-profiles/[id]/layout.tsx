"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function CustomerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`ملف العميل: ${resolvedParams.id}`}
      subtitle="استعراض البطاقة الكاملة والتحديث المباشر"
      basePath={`/crm/customer-profiles/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
