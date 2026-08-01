"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function CrmTaskDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
    const { t } = useI18n();
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`مهمة الـ CRM: ${resolvedParams.id}`}
      subtitle={t.crm.appointmentManagementAndDir}
      basePath={`/crm/activities-tasks-calendar-reminders/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
