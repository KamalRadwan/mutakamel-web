"use client";

import { Pencil } from "lucide-react";
import {
  Badge,
  Button,
  ConflictDialog,
  DetailHeader,
  DetailSection,
  ErrorState,
  NotFoundState,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../../../trade-advanced-validation";
import { INVENTORY_READ_PERMISSION } from "../../../inventory-contract";
import { useInventoryNode } from "../hooks/useInventoryNode";
import { EditNodeModal } from "./EditNodeModal";

export function NodeDetailWorkspace({ nodeId }: { nodeId: string }) {
  const { t } = useI18n();
  const {
    lang,
    canRead,
    canManage,
    node,
    isLoading,
    queryError,
    isNotFound,
    isSubmitting,
    formError,
    editOpen,
    conflictOpen,
    openEdit,
    closeEdit,
    resolveConflict,
    dismissConflict,
    update,
    reload,
  } = useInventoryNode(nodeId);

  const content = (
    <div className="flex flex-col gap-4">
      <DetailHeader
        title={node?.code ?? t.tradeInventory.nodeDetailTitle}
        subtitle={node?.name}
        status={
          node ? (
            <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
              {tradeStatusLabel(t.tradeStatus, node.status, t.common.unknownCode)}
            </Badge>
          ) : undefined
        }
        backLabel={t.tradeInventory.backToNodes}
        backHref={TENANT_ROUTES.tradeInventoryNodes}
        secondaryActions={
          canManage && node ? (
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="size-4" aria-hidden="true" />
              {t.tradeInventory.nodeEditTitle}
            </Button>
          ) : undefined
        }
      />

      {isNotFound ? (
        <NotFoundState
          title={t.tradeInventory.nodeNotFound}
          description={t.tradeInventory.nodeNotFoundDescription}
          backLabel={t.tradeInventory.backToNodes}
          backHref={TENANT_ROUTES.tradeInventoryNodes}
        />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : queryError ? (
        <ErrorState
          title={t.tradeInventory.nodeLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : node ? (
        <>
          <DetailSection
            title={t.tradeCommon.overview}
            emptyValueLabel={t.tradeCommon.notSet}
            fields={[
              { label: t.tradeInventory.nodeType, value: tradeStatusLabel(t.tradeStatus, node.nodeType, t.common.unknownCode) },
              { label: t.tradeInventory.nodeTimezone, value: node.timezone },
              { label: t.tradeCommon.version, value: String(node.version) },
              { label: t.tradeCommon.updatedAt, value: formatDateTime(node.updatedAt, lang) },
            ]}
          />
          <DetailSection
            title={t.tradeInventory.nodeBranches}
            description={t.tradeInventory.nodeBranchesDetailHint}
            emptyValueLabel={t.tradeCommon.notSet}
            columns={1}
            fields={node.branches.map((branch) => ({
              label: branch.branchId,
              value: branch.isActive ? t.common.active : t.common.inactive,
            }))}
          />
        </>
      ) : null}

      {node && editOpen ? (
        <EditNodeModal
          key={node.version}
          node={node}
          isOpen={editOpen}
          onClose={closeEdit}
          onSubmit={update}
          isSubmitting={isSubmitting}
          error={formError}
        />
      ) : null}

      <ConflictDialog
        open={conflictOpen}
        onOpenChange={(open) => {
          if (!open) dismissConflict();
        }}
        title={t.tradeCommon.conflictTitle}
        description={t.tradeCommon.conflictDescription}
        onReload={resolveConflict}
        onCancel={dismissConflict}
        loading={isSubmitting}
        labels={{
          yourChanges: t.tradeCommon.yourChanges,
          theirChanges: t.tradeCommon.theirChanges,
          reload: t.tradeCommon.conflictReload,
          overwrite: t.tradeCommon.conflictOverwrite,
          cancel: t.common.cancel,
        }}
      />
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
