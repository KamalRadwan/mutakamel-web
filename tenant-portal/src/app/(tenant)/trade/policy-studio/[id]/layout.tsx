"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function PolicyDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`السياسة والقاعدة: ${resolvedParams.id}`}
      subtitle="تفاصيل الشروط والأولوية والتحديث المباشر"
      basePath={`/trade/policy-studio/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
