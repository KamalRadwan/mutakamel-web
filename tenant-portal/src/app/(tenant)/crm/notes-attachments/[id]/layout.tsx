"use client";

import { use } from "react";
import { DetailTabsLayout } from "@/components/ui/DetailTabsLayout";

export default function NoteDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <DetailTabsLayout
      title={`الملاحظة والمرفق: ${resolvedParams.id}`}
      subtitle="ملاحظات الاجتماع والتعديل المباشر"
      basePath={`/crm/notes-attachments/${resolvedParams.id}`}
    >
      {children}
    </DetailTabsLayout>
  );
}
