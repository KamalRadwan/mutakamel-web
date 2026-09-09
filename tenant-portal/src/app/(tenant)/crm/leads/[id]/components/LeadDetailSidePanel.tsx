"use client";

import { History, ListTodo, Paperclip } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger, iconSize } from "@/design-system";
import { EntityHistoryCard, type EntityHistoryCardProps } from "@/components/audit/EntityHistoryCard";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadDetail } from "../../lead-contract";
import type { LeadDetailCapabilities } from "../../hooks/useLeadCapabilities";
import { RecordAttachmentsSection } from "../../../shared/components/RecordAttachmentsSection";
import { useLeadSidePanel } from "../hooks/useLeadSidePanel";
import { LeadActivitiesPanel } from "./LeadActivitiesPanel";

interface LeadDetailSidePanelProps {
  lead: LeadDetail;
  capabilities: Pick<LeadDetailCapabilities, "attachmentsCreate" | "attachmentsDelete">;
  readOnly: boolean;
  historyValueLabels?: EntityHistoryCardProps['valueLabels'];
}

export function LeadDetailSidePanel({ lead, capabilities, readOnly, historyValueLabels }: LeadDetailSidePanelProps) {
  const { t, dir } = useI18n();
  const panel = useLeadSidePanel();
  const tabs = [
    { value: "history", label: t.audit.historyTitle, Icon: History },
    { value: "activities", label: t.crmLeads.activities.title, Icon: ListTodo },
    { value: "attachments", label: t.attachments.title, Icon: Paperclip },
  ];
  return (
    <Tabs value={panel.active} onValueChange={panel.select} dir={dir} className="min-w-0">
      <TabsList className="grid min-h-(--size-control-sm) w-full grid-cols-3 rounded-md border bg-card">
        {tabs.map(({ value, label, Icon }) => (
          <TabsTrigger key={value} value={value} aria-label={label} title={label} className="h-(--size-control-sm) justify-center">
            <Icon className={iconSize({ size: "sm" })} aria-hidden="true" />
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="history" className="mt-2">
        {/* Exact ledger entity name, including capital L. Refresh on returning to History. */}
        <EntityHistoryCard density="compact" entityType="Lead" entityId={lead.id}
          valueLabels={historyValueLabels}
          relatedPartyIds={[lead.partyId, ...lead.contacts.map((contact) => contact.partyId)]}
          refreshToken={lead} />
      </TabsContent>
      {/* Lazy on first visit; keep state alive when hidden, especially an upload in flight. */}
      {panel.visited.activities && (
        <TabsContent value="activities" forceMount hidden={panel.active !== "activities"} className="mt-2">
          <LeadActivitiesPanel lead={{ id: lead.id, name: lead.displayName }} readOnly={readOnly} />
        </TabsContent>
      )}
      {panel.visited.attachments && (
        <TabsContent value="attachments" forceMount hidden={panel.active !== "attachments"} className="mt-2">
          <RecordAttachmentsSection branchId={lead.branchId} sourceType="LEAD" sourceId={lead.id}
            sourceOwnerUserId={lead.ownerUserId} createCapability={capabilities.attachmentsCreate}
            deleteCapability={capabilities.attachmentsDelete} readOnly={readOnly} uploadVariant="button" density="compact" />
        </TabsContent>
      )}
    </Tabs>
  );
}
