"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function PartyDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الجهة: ${resolvedParams.id}`}
      subtitle="إدارة بيانات الجهة، أدوار الأطراف والتحديث المباشر"
      basePath={`/core/party-directory/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
