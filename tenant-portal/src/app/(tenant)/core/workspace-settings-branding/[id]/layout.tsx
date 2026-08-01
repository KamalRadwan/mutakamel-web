"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function WorkspaceDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`ملف الهوية: ${resolvedParams.id}`}
      subtitle="تعديل تخصيص الألوان والسمة واللغة المباشرة"
      basePath={`/core/workspace-settings-branding/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
