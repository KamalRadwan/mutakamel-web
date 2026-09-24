"use client";

import { useState } from "react";
import { History, ListTodo, Paperclip } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger, iconSize } from "@/design-system";
import { RecordActivitiesPanel } from "@/components/activities/RecordActivitiesPanel";
import { EntityHistoryCard } from "@/components/audit/EntityHistoryCard";
import { useI18n } from "@/i18n/I18nContext";
import { RecordAttachmentsSection } from "../../../shared/components/RecordAttachmentsSection";
import type { OpportunityDetail } from "../../opportunity-contract";
import type { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";

type OpportunityPanel = "history" | "activities" | "attachments";

export interface OpportunityDetailSidePanelProps {
  item: OpportunityDetail;
  attached: ReturnType<typeof useCrmRecordCapabilities>;
  readOnly: boolean;
  stageLabels?: Readonly<Record<string, string>>;
  pipelineLabels?: Readonly<Record<string, string>>;
}

export function OpportunityDetailSidePanel({
  item,
  attached,
  readOnly,
  stageLabels,
  pipelineLabels,
}: OpportunityDetailSidePanelProps) {
  const { t, dir } = useI18n();
  const [activeTab, setActiveTab] = useState<OpportunityPanel>("history");
  const [visited, setVisited] = useState({ activities: false, attachments: false });
  const selectTab = (value: string) => {
    if (value !== "history" && value !== "activities" && value !== "attachments") return;
    setActiveTab(value);
    if (value !== "history") {
      setVisited((current) => ({ ...current, [value]: true }));
    }
  };

  const tabs = [
    { value: "history", label: t.audit.historyTitle, Icon: History },
    { value: "activities", label: t.activities.title, Icon: ListTodo },
    { value: "attachments", label: t.attachments.title, Icon: Paperclip },
  ];
  const relatedPartyIds = [item.customerPartyId, item.contactPartyId].filter(
    (id): id is string => Boolean(id),
  );

  return (
    <Tabs value={activeTab} onValueChange={selectTab} dir={dir} className="min-w-0">
      <TabsList className="grid min-h-(--size-control-sm) w-full grid-cols-3 rounded-md border bg-card">
        {tabs.map(({ value, label, Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            aria-label={label}
            title={label}
            className="h-(--size-control-sm) justify-center"
          >
            <Icon className={iconSize({ size: "sm" })} aria-hidden="true" />
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="history" className="mt-2">
        <EntityHistoryCard
          density="compact"
          entityType="Opportunity"
          entityId={item.id}
          relatedPartyIds={relatedPartyIds}
          refreshToken={item}
          valueLabels={{
            ...(stageLabels ? { stageId: stageLabels } : {}),
            ...(pipelineLabels ? { pipelineId: pipelineLabels } : {}),
          }}
        />
      </TabsContent>

      {visited.activities && (
        <TabsContent
          value="activities"
          forceMount
          hidden={activeTab !== "activities"}
          className="mt-2"
        >
          <RecordActivitiesPanel
            target={{ app: "CRM", type: "OPPORTUNITY", id: item.id, label: item.title }}
            readOnly={readOnly}
          />
        </TabsContent>
      )}

      {visited.attachments && (
        <TabsContent
          value="attachments"
          forceMount
          hidden={activeTab !== "attachments"}
          className="mt-2"
        >
          <RecordAttachmentsSection
            branchId={item.branchId}
            sourceType="OPPORTUNITY"
            sourceId={item.id}
            sourceOwnerUserId={item.ownerUserId}
            createCapability={attached.capabilities.attachmentsCreate}
            deleteCapability={attached.capabilities.attachmentsDelete}
            readOnly={readOnly}
            uploadVariant="button"
            density="compact"
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
