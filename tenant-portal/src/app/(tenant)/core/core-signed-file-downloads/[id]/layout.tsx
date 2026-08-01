"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function CoreSignedFileDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`رابط الملف الموقع: ${resolvedParams.id}`}
      subtitle="إدارة التفاصيل، الصلاحيات الزمانية، ورسائل السجل"
      basePath={`/core/core-signed-file-downloads/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
