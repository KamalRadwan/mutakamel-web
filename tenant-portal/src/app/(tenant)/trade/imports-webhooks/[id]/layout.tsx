"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function ImportWebhookDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الاستيراد / Webhook: ${resolvedParams.id}`}
      subtitle="استعراض الأخطاء، الرصيد والتحديث المباشر"
      basePath={`/trade/imports-webhooks/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
