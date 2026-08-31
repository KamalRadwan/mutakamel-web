"use client";

import { use } from "react";
import {
  Badge,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
  Timeline,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../../trade-advanced-validation";
import { INVENTORY_READ_PERMISSION } from "../../inventory-contract";
import { useInventorySerial } from "./hooks/useInventorySerial";

export default function InventorySerialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, lang, canRead, serial, isLoading, queryError, isNotFound, reload } =
    useInventorySerial(id);

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={serial?.serialKey ?? t.tradeInventory.serialDetailTitle}
        subtitle={serial?.itemId}
        status={
          serial ? (
            <Badge tone="neutral">{tradeStatusLabel(t.tradeStatus, serial.state)}</Badge>
          ) : undefined
        }
        backLabel={t.tradeInventory.backToSerials}
        backHref={TENANT_ROUTES.tradeInventorySerials}
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeInventory.serialNotFound}
          description={t.tradeInventory.serialNotFoundDescription}
          backLabel={t.tradeInventory.backToSerials}
          backHref={TENANT_ROUTES.tradeInventorySerials}
        />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeInventory.serialLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : serial ? (
        <>
          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              { label: t.tradeInventory.itemId, value: serial.itemId },
              {
                label: t.tradeInventory.itemCompanyProfileId,
                value: serial.itemCompanyProfileId,
              },
              { label: t.tradeInventory.currentNode, value: serial.currentFulfillmentNodeId },
              {
                label: t.tradeInventory.lastTransitionAt,
                value: formatDateTime(serial.lastTransitionAt, lang),
              },
            ]}
          />
          <DetailSection title={t.tradeInventory.serialLifecycle}>
            {serial.lifecycle.length > 0 ? (
              <Timeline
                label={t.tradeInventory.serialLifecycle}
                events={serial.lifecycle.map((entry) => ({
                  id: entry.id,
                  title: tradeStatusLabel(t.tradeStatus, entry.eventType),
                  timestamp: formatDateTime(entry.occurredAt, lang),
                }))}
              />
            ) : (
              <EmptyState title={t.tradeInventory.serialLifecycleEmpty} />
            )}
          </DetailSection>
        </>
      ) : null}
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
