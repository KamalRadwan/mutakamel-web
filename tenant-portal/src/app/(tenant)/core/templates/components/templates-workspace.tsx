"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  CORE_TEMPLATE_NAV_ITEMS,
  DataTable,
  DegradedBanner,
  FilterBar,
  IdentifierText,
  PageHeader,
  PermissionGate,
  SubNav,
  type ColumnDef,
  type FilterValue,
  UnavailableState,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  TEMPLATE_DOCUMENT_TYPES,
  TEMPLATE_LIFECYCLE_STATUSES,
  TEMPLATE_OUTPUT_CHANNELS,
  TEMPLATE_READ_PERMISSION,
  type TemplateListItem,
} from "../templates-contract";
import { useTemplateList } from "../hooks/useTemplateList";
import { CreateTemplateDrawer } from "./CreateTemplateDrawer";

const VALIDATION_TONE: Record<string, "positive" | "negative" | "caution" | "neutral"> = {
  PASSED: "positive",
  FAILED: "negative",
  STALE: "caution",
  NOT_VALIDATED: "neutral",
};

export function TemplatesWorkspace() {
  const list = useTemplateList();
  const { t, lang } = list;
  const copy = t.coreOperations.templates;
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // A tenant without `core.template_designer` gets 403 from every route here.
  // That is an entitlement boundary, not an empty list and not a permission
  // error, so it renders the unavailable surface.
  if (list.isEntitlementBlocked) {
    return <UnavailableState backHref={TENANT_ROUTES.core} />;
  }

  const columns: ColumnDef<TemplateListItem>[] = [
    {
      id: "name",
      header: copy.name,
      cell: (template) => (
        <span className="flex flex-col">
          <span className="font-medium text-foreground">{template.name}</span>
          <IdentifierText className="text-xs text-muted-foreground">{template.code}</IdentifierText>
        </span>
      ),
    },
    {
      id: "documentType",
      header: copy.documentType,
      cell: (template) => copy.documentTypes[template.documentType] ?? template.documentType,
    },
    {
      id: "outputChannel",
      header: copy.outputChannel,
      cell: (template) => copy.outputChannels[template.outputChannel] ?? template.outputChannel,
    },
    {
      id: "draft",
      header: copy.draftState,
      cell: (template) => (
        <span className="flex items-center gap-2">
          <Badge tone={VALIDATION_TONE[template.draft.validationState] ?? "neutral"}>
            {copy.validationStates[template.draft.validationState]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {copy.revisionShort}
            {template.draft.revision}
          </span>
        </span>
      ),
    },
    {
      id: "published",
      header: copy.publishedVersion,
      cell: (template) =>
        template.currentPublishedVersion
          ? `v${template.currentPublishedVersion.versionNumber}`
          : copy.notPublished,
    },
    {
      id: "lifecycleStatus",
      header: t.common.status,
      cell: (template) => (
        <Badge tone={template.lifecycleStatus === "ACTIVE" ? "positive" : "neutral"}>
          {copy.lifecycleStatuses[template.lifecycleStatus] ?? template.lifecycleStatus}
        </Badge>
      ),
    },
    {
      id: "updatedAt",
      header: copy.updatedAt,
      cell: (template) => formatDateTime(template.updatedAt, lang),
    },
  ];

  const selected = (value: FilterValue | undefined): string | undefined =>
    value?.kind === "select" && value.value ? value.value : undefined;

  return (
    <PermissionGate require={TEMPLATE_READ_PERMISSION}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.listTitle}
          description={copy.listSubtitle}
          primaryAction={
            list.canCreate ? { label: copy.create, onClick: () => setIsCreateOpen(true) } : undefined
          }
          secondaryActions={
            <Button variant="outline" onClick={list.reload} disabled={list.isLoading}>
              <RefreshCw
                className={list.isLoading ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <SubNav items={CORE_TEMPLATE_NAV_ITEMS} />

        {list.cursor.wasReset ? (
          <DegradedBanner message={copy.cursorExpired} />
        ) : null}

        <FilterBar
          filters={[
            {
              id: "documentType",
              kind: "select",
              label: copy.documentType,
              placeholder: copy.anyValue,
              options: TEMPLATE_DOCUMENT_TYPES.map((value) => ({
                value,
                label: copy.documentTypes[value],
              })),
            },
            {
              id: "outputChannel",
              kind: "select",
              label: copy.outputChannel,
              placeholder: copy.anyValue,
              options: TEMPLATE_OUTPUT_CHANNELS.map((value) => ({
                value,
                label: copy.outputChannels[value],
              })),
            },
            {
              id: "lifecycleStatus",
              kind: "select",
              label: t.common.status,
              placeholder: copy.anyValue,
              options: TEMPLATE_LIFECYCLE_STATUSES.map((value) => ({
                value,
                label: copy.lifecycleStatuses[value],
              })),
            },
          ]}
          values={{
            ...(list.filters.documentType
              ? { documentType: { kind: "select" as const, value: list.filters.documentType } }
              : {}),
            ...(list.filters.outputChannel
              ? { outputChannel: { kind: "select" as const, value: list.filters.outputChannel } }
              : {}),
            ...(list.filters.lifecycleStatus
              ? {
                  lifecycleStatus: {
                    kind: "select" as const,
                    value: list.filters.lifecycleStatus,
                  },
                }
              : {}),
          }}
          onChange={(next) =>
            list.applyFilters({
              documentType: selected(next.documentType),
              outputChannel: selected(next.outputChannel),
              lifecycleStatus: selected(next.lifecycleStatus),
              name: list.filters.name,
            })
          }
          onReset={() => list.applyFilters({})}
          searchValue={list.filters.name ?? ""}
          onSearchChange={(value) => list.applyFilters({ ...list.filters, name: value })}
          searchPlaceholder={copy.searchPlaceholder}
          clearAllLabel={t.filters.clearAll}
          filtersLabel={t.common.filter}
        />

        <DataTable
          columns={columns}
          rows={list.items}
          isLoading={list.isLoading}
          error={list.error}
          onRetry={list.reload}
          rowKey={(template) => template.id}
          onRowClick={list.openTemplate}
          labels={{
            retry: t.common.retry,
            errorTitle: copy.loadFailed,
            emptyTitle: copy.empty,
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

        {/* Cursor paging, not page numbers: this endpoint has no page index, so
            no page control is fabricated over it. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {copy.pageIndicator} {list.cursor.pageNumber}
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={list.startOver}
              disabled={!list.cursor.canGoBack || list.isLoading}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {copy.startOver}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={list.goBack}
              disabled={!list.cursor.canGoBack || list.isLoading}
            >
              <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              {t.common.previousPage}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={list.goNext}
              disabled={!list.hasNextPage || list.isLoading}
            >
              {t.common.nextPage}
              <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </span>
        </div>

        <CreateTemplateDrawer isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      </div>
    </PermissionGate>
  );
}
