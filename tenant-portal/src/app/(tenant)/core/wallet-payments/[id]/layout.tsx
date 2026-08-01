"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function WalletDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`حركة المحفظة: ${resolvedParams.id}`}
      subtitle="معاينة تفاصيل الشحن / الخصم والتحديث المباشر"
      basePath={`/core/wallet-payments/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
