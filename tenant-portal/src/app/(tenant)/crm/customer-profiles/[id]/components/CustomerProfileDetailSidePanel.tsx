"use client";

import { History, ListTodo, Paperclip } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  iconSize,
} from "@/design-system";
import { EntityHistoryCard } from "@/components/audit/EntityHistoryCard";
import { useI18n } from "@/i18n/I18nContext";
import { RecordAttachmentsSection } from "../../../shared/components/RecordAttachmentsSection";
import { CrmActivitiesPanel } from "../../../shared/components/CrmActivitiesPanel";
import type { CustomerProfileDetail } from "../../customer-profile-contract";
import type { useCrmRecordCapabilities } from "../../../shared/hooks/useCrmRecordCapabilities";
import { useCustomerProfileSidePanel } from "../hooks/useCustomerProfileSidePanel";

export interface CustomerProfileDetailSidePanelProps {
  profile: CustomerProfileDetail;
  attached: ReturnType<typeof useCrmRecordCapabilities>;
  readOnly: boolean;
}

export function CustomerProfileDetailSidePanel({
  profile,
  attached,
  readOnly,
}: CustomerProfileDetailSidePanelProps) {
  const { t, dir } = useI18n();
  const panel = useCustomerProfileSidePanel();

  const tabs = [
    { value: "history", label: t.audit.historyTitle, Icon: History },
    { value: "activities", label: t.crmLeads.activities.title, Icon: ListTodo },
    { value: "attachments", label: t.attachments.title, Icon: Paperclip },
  ];

  return (
    <Tabs
      value={panel.active}
      onValueChange={panel.select}
      dir={dir}
      className="min-w-0"
    >
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
          entityType="CustomerProfile"
          entityId={profile.id}
          relatedPartyIds={[
            profile.partyId,
            ...profile.contacts.map((contact) => contact.partyId),
          ]}
          refreshToken={profile}
        />
      </TabsContent>

      {panel.visited.activities && (
        <TabsContent
          value="activities"
          forceMount
          hidden={panel.active !== "activities"}
          className="mt-2"
        >
          <CrmActivitiesPanel
            target={{
              id: profile.id,
              name: profile.displayName,
              targetType: "CUSTOMER_PROFILE",
            }}
            readOnly={readOnly}
          />
        </TabsContent>
      )}

      {panel.visited.attachments && (
        <TabsContent
          value="attachments"
          forceMount
          hidden={panel.active !== "attachments"}
          className="mt-2"
        >
          <RecordAttachmentsSection
            branchId={profile.branchId}
            sourceType="CUSTOMER_PROFILE"
            sourceId={profile.id}
            sourceOwnerUserId={profile.ownerUserId}
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
