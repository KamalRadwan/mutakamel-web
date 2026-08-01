"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function CatalogueDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الكتالوج المرجعي: ${resolvedParams.id}`}
      subtitle="إدارة الخيارات والقوائم الفرعية والتحديث المباشر"
      basePath={`/crm/static-data-catalogue/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
