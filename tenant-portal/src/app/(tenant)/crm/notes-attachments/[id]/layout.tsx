"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";
import { useI18n } from "@/i18n/I18nContext";

export default function NoteDetailLayout({
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
      title={`الملاحظة والمرفق: ${resolvedParams.id}`}
      subtitle={t.crm.meetingNotesAndLiveEditing}
      basePath={`/crm/notes-attachments/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
