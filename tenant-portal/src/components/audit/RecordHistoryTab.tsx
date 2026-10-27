"use client";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { EntityHistoryCard, type EntityHistoryCardProps } from "./EntityHistoryCard";
import { useAuditAccess } from "./hooks/useAuditAccess";

// Existing dossiers provide their own tab navigation; standalone record pages
// pass their content so the same permission gate also owns the History trigger.
export function RecordHistoryTab({ children, ...subject }: EntityHistoryCardProps & { children?: ReactNode }) {
  const { t } = useI18n();
  const canRead = useAuditAccess();
  if (!canRead) return children ?? null;
  if (children === undefined) return <EntityHistoryCard {...subject} />;
  return <Tabs defaultValue="record" className="flex min-h-0 flex-1 flex-col gap-4">
    <TabsList aria-label={t.audit.ledger.record}>
      <TabsTrigger value="record">{t.audit.ledger.record}</TabsTrigger>
      <TabsTrigger value="history">{t.audit.historyTitle}</TabsTrigger>
    </TabsList>
    <TabsContent value="record" forceMount className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden">{children}</TabsContent>
    <TabsContent value="history" className="mt-0"><EntityHistoryCard {...subject} /></TabsContent>
  </Tabs>;
}
