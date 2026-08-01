"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function ScopeDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`نطاق التهيئة: ${resolvedParams.id}`}
      subtitle="تخصيص قواعد وتوريث الميزات المباشر"
      basePath={`/trade/configuration-scope/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
