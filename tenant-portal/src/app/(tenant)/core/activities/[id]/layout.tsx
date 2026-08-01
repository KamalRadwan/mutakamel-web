"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function ActivityDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`النشاط: ${resolvedParams.id}`}
      subtitle="عرض وتحديث بيانات المهمة والإنهاء المباشر"
      basePath={`/core/activities/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
