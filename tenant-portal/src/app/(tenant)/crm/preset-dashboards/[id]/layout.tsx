"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function PresetDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`اللوحة المسبقة: ${resolvedParams.id}`}
      subtitle="تعديل الودجتس وتوزيع الشاشة والتحديث المباشر"
      basePath={`/crm/dashboard/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
