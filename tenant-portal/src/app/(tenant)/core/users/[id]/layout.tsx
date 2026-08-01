"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function UserDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`حساب المستخدم: ${resolvedParams.id}`}
      subtitle="تعديل البيانات الشخصية، الأدوار والتحديث المباشر"
      basePath={`/core/users/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
