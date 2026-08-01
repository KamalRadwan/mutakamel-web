"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function OrgDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الوحدة التنظيمية: ${resolvedParams.id}`}
      subtitle="إدارة بيانات الفرع / القسم والتعديل المباشر"
      basePath={`/core/organization/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
