"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function DocumentProfileDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`البروفايل المستندي: ${resolvedParams.id}`}
      subtitle="تعديل الحقول وقواعد الفسح ZATCA والتحديث المباشر"
      basePath={`/trade/document-profile-platform/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
