"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function OutboundEmailDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`البريد الصادر: ${resolvedParams.id}`}
      subtitle="استعراض الرسالة والتحديث المباشر"
      basePath={`/crm/outbound-emails/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
