"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function RoleDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الدور والصلاحية: ${resolvedParams.id}`}
      subtitle="تعديل مصفوفة الصلاحيات والتحديث المباشر"
      basePath={`/core/roles-role-assignments/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
