"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function CustomFieldDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الحقل المخصص: ${resolvedParams.id}`}
      subtitle="إدارة الخيارات والتعديل المباشر"
      basePath={`/crm/custom-fields/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
