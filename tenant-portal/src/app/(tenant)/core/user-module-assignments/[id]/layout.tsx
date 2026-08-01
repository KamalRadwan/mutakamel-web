"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function UserModuleDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`تخصيص الموديول: ${resolvedParams.id}`}
      subtitle="إدارة ربط الموديول والتعديل المباشر"
      basePath={`/core/user-module-assignments/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
