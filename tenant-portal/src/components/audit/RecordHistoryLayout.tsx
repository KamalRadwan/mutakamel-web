"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { auditSubjectForPath } from "@/lib/audit/catalogue";
import { RecordHistoryTab } from "./RecordHistoryTab";

export function RecordHistoryLayout({ children }: { children: ReactNode }) {
  const subject = auditSubjectForPath(usePathname());
  if (!subject) return children;
  return <RecordHistoryTab key={`${subject.entityType}:${subject.entityId}`} {...subject}>{children}</RecordHistoryTab>;
}
