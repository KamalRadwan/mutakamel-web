"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function ProvisioningUpdateDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`تحديث التزويد: ${resolvedParams.id}`}
      subtitle="تفاصيل حزمة التحديث والموافقة المباشرة"
      basePath={`/core/provisioning-updates/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
