"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function NotificationConfigDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`إعداد القناة: ${resolvedParams.id}`}
      subtitle="اختبار الاتصال المباشر والضبط المباشر للمرسل"
      basePath={`/core/notifications-email-configuration/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
