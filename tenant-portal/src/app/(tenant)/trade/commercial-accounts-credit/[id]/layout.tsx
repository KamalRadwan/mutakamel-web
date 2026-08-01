"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function AccountDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الحساب التجاري: ${resolvedParams.id}`}
      subtitle="تفاصيل الائتمان والشروط والتحديث المباشر"
      basePath={`/trade/commercial-accounts-credit/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
