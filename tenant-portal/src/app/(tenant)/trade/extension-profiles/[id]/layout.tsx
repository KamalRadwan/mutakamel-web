"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function ExtensionDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الملحق التوسعي: ${resolvedParams.id}`}
      subtitle="تفاصيل النقاط المحقونة والتحديث المباشر"
      basePath={`/trade/extension-profiles/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
