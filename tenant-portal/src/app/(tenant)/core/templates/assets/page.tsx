"use client";

import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmActionModal,
  DataTable,
  DegradedBanner,
  PageHeader,
  PermissionGate,
  SubNav,
  UnavailableState,
  CORE_TEMPLATE_NAV_ITEMS,
  type ColumnDef,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TEMPLATE_READ_PERMISSION } from "../templates-contract";
import { assetContentHref, type TemplateAsset } from "../template-assets-contract";
import { UploadAssetDrawer } from "./components/UploadAssetDrawer";
import { useTemplateAssets } from "./hooks/useTemplateAssets";

export default function TemplateAssetsPage() {
  const assets = useTemplateAssets();
  const { t, lang } = assets;
  const copy = t.coreOperations.templates;

  if (assets.isEntitlementBlocked) {
    return <UnavailableState backHref={TENANT_ROUTES.core} />;
  }

  const columns: ColumnDef<TemplateAsset>[] = [
    {
      id: "fileName",
      header: copy.assetFile,
      cell: (asset) => (
        <span className="flex flex-col">
          <span className="text-foreground">{asset.originalFileName}</span>
          <span className="text-xs text-muted-foreground">{asset.mimeType}</span>
        </span>
      ),
    },
    {
      id: "assetType",
      header: copy.assetType,
      cell: (asset) => copy.assetTypes[asset.assetType] ?? asset.assetType,
    },
    {
      id: "delivery",
      header: copy.assetDelivery,
      cell: (asset) => (
        <Badge tone={asset.deliveryClass === "EMAIL_PUBLIC" ? "caution" : "neutral"}>
          {copy.assetDeliveryClasses[asset.deliveryClass] ?? asset.deliveryClass}
        </Badge>
      ),
    },
    {
      id: "status",
      header: t.common.status,
      cell: (asset) => (
        <Badge tone={asset.status === "ACTIVE" ? "positive" : "neutral"}>
          {copy.assetStatuses[asset.status] ?? asset.status}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: copy.assetCreatedAt,
      cell: (asset) => formatDateTime(asset.createdAt, lang),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (asset) => (
        <span className="flex items-center justify-end gap-1">
          {asset.status === "ACTIVE" ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`${copy.assetOpen}: ${asset.originalFileName}`}
              onClick={() =>
                window.open(assetContentHref(asset.id), "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          {assets.canManage && asset.status === "ACTIVE" ? (
            <Button
              variant="ghost"
              size="xs"
              aria-label={`${copy.assetRetire}: ${asset.originalFileName}`}
              disabled={assets.pendingId !== null}
              onClick={() => assets.openRetire(asset)}
            >
              <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <PermissionGate require={TEMPLATE_READ_PERMISSION}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.assetsTitle}
          description={copy.assetsSubtitle}
          primaryAction={
            assets.canManage ? { label: copy.assetUpload, onClick: assets.openUpload } : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={assets.reload} disabled={assets.isLoading}>
              <RefreshCw
                className={assets.isLoading ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <SubNav items={CORE_TEMPLATE_NAV_ITEMS} />

        {assets.cursor.wasReset ? <DegradedBanner message={copy.cursorExpired} /> : null}

        <DataTable
          columns={columns}
          rows={assets.items}
          isLoading={assets.isLoading}
          error={assets.error}
          onRetry={assets.reload}
          rowKey={(asset) => asset.id}
          labels={{
            retry: t.common.retry,
            errorTitle: copy.assetsLoadFailed,
            emptyTitle: copy.assetsEmpty,
            selectAll: t.views.selectAll,
            selectRow: t.views.selectItem,
            sortAscending: t.views.sortAscending,
            sortDescending: t.views.sortDescending,
            notSorted: t.views.notSorted,
            pagination: {
              previous: t.common.previousPage,
              next: t.common.nextPage,
              summary: () => "",
            },
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {copy.pageIndicator} {assets.cursor.pageNumber}
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={assets.goBack}
              disabled={!assets.cursor.canGoBack || assets.isLoading}
            >
              <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              {t.common.previousPage}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={assets.goNext}
              disabled={!assets.hasNextPage || assets.isLoading}
            >
              {t.common.nextPage}
              <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </span>
        </div>

        <UploadAssetDrawer
          key={assets.isUploadOpen ? "asset-open" : "asset-closed"}
          isOpen={assets.isUploadOpen}
          onClose={assets.closeUpload}
          onSubmit={assets.upload}
          isSubmitting={assets.isSubmitting}
          error={assets.formError}
        />

        <ConfirmActionModal
          open={assets.retiring !== null}
          onOpenChange={(open) => {
            if (!open) assets.closeRetire();
          }}
          title={copy.assetRetireTitle}
          description={copy.assetRetireDescription}
          confirmLabel={copy.assetRetire}
          cancelLabel={t.common.cancel}
          onConfirm={() => void assets.retire()}
          loading={assets.pendingId !== null}
        />
      </div>
    </PermissionGate>
  );
}
