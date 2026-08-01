"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function CrmTaskDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`مهمة الـ CRM: ${resolvedParams.id}`}
      subtitle="إدارة الموعد والتعديل المباشر"
      basePath={`/crm/activities-tasks-calendar-reminders/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
