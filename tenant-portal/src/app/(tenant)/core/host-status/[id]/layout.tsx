"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function HostStatusDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`النطاق الخادم: ${resolvedParams.id}`}
      subtitle="معاينة إعدادات التوجيه الفعلي والتعديل الفوري"
      basePath={`/core/host-status/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
