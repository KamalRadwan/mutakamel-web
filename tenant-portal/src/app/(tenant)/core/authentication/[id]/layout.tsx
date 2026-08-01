"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function AuthenticationDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`تفاصيل الجلسة: ${resolvedParams.id}`}
      subtitle="إدارة الجلسات والأمان والتحكم المباشر"
      basePath={`/core/authentication/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
