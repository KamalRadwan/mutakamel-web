"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, Puzzle, RefreshCw } from "lucide-react";
import {
  Badge, Button, DataTable, DegradedBanner, ErrorState, FilterBar, PageHeader,
  StatCard, StatGrid, StatusBadge, type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { ADDONS_INDEX_PAGE_SIZE, useAddonsCatalogueWorkspace, type AddonIndexRow } from "../hooks/useAddonsCatalogueWorkspace";
import { useAddonMutation } from "../hooks/useAddonMutation";
import { addonCopy, type AddonCopy } from "../lib/addon-copy";
import type { ApplicationView } from "../types";
import { AddonDefinitionDialog } from "./AddonDefinitionDialog";
import { AddonDetailPanel } from "./AddonDetailPanel";
import { AddonOwnerPicker } from "./AddonOwnerPicker";

export function AddonsCatalogueWorkspace() {
  const { lang } = useI18n();
  const copy = addonCopy(lang);
  const state = useAddonsCatalogueWorkspace();
  /**
   * Deleting from the panel destroys the row that opened it, so Radix's own
   * focus restore lands on <body> and the operator loses their place. Sending
   * focus back to the top of the index is the nearest stable anchor.
   */
  const indexRef = useRef<HTMLDivElement>(null);
  const deleted = useCallback(() => {
    state.closeDetail();
    state.refresh();
    queueMicrotask(() => indexRef.current?.focus());
  }, [state]);

  if (!state.canRead) {
    // A forbidden section is its own state, not an empty list, and it must not
    // advertise the actions it cannot perform.
    return (
      <div className="w-full space-y-3">
        <PageHeader title={copy.indexTitle} />
        <p role="alert" className="rounded-lg border border-warning bg-warning-subtle p-3 text-xs text-warning-subtle-foreground">
          {copy.forbidden} <code dir="ltr">admin.applications.read</code>
        </p>
      </div>
    );
  }

  const columns: ColumnDef<AddonIndexRow>[] = [
    {
      key: "addon",
      headerEn: "Addon",
      headerAr: copy.columnAddon,
      cell: row => (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto min-h-8 flex-col items-start gap-0.5 px-0 py-0.5 text-start"
          onClick={() => state.openDetail(row.addon.key)}
        >
          <span className="text-xs font-semibold">{row.addon.name}</span>
          <bdi className="block break-all font-mono text-xs text-muted-foreground" dir="ltr">{row.addon.key}</bdi>
        </Button>
      ),
    },
    {
      key: "application",
      headerEn: "Application",
      headerAr: copy.columnApplication,
      cell: row => (
        <Link href={`/applications-catalogue/${row.application.key}`} className="inline-flex flex-col gap-0.5">
          <span className="text-xs font-medium">{row.application.name}</span>
          <bdi className="font-mono text-xs text-muted-foreground" dir="ltr">{row.application.key}</bdi>
        </Link>
      ),
    },
    {
      key: "lifecycle",
      headerEn: "Lifecycle",
      headerAr: copy.lifecycle,
      // Addon and application lifecycles share the same four wire values, so
      // this reuses the mapped tones rather than inventing a parallel scale.
      cell: row => <StatusBadge status={row.addon.lifecycleStatus} enumType="application" />,
    },
    {
      key: "publication",
      headerEn: "Publication",
      headerAr: copy.columnPublication,
      priority: "supporting",
      // A published version and a pending draft are independent facts and the
      // index has to keep them distinguishable.
      cell: row => (
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={row.addon.publishedVersionId ? "brand" : "neutral"}>
            {row.addon.publishedVersionId ? copy.published : copy.unpublished}
          </Badge>
          {row.addon.draftVersionId && <Badge tone="warn">{copy.draft}</Badge>}
        </div>
      ),
    },
    {
      key: "catalogueRevision",
      headerEn: "Catalogue revision",
      headerAr: copy.catalogueRevision,
      priority: "detail",
      align: "end",
      // Revisions are 19-digit wire strings; they are rendered, never parsed.
      cell: row => <bdi className="font-mono text-xs">{row.addon.catalogueRevision}</bdi>,
    },
  ];

  return (
    <div ref={indexRef} tabIndex={-1} className="w-full space-y-3 outline-none">
      <PageHeader
        title={copy.indexTitle}
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" loading={state.isLoading || state.isRefreshing} onClick={state.refresh}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {copy.refresh}
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/applications-catalogue">
                {copy.applicationsLink}
              </Link>
            </Button>
            {state.canCreate && (
              <Button type="button" variant="primary" size="sm" onClick={() => state.openCreate()}>
                <Plus className="size-3.5" aria-hidden="true" />
                {copy.create}
              </Button>
            )}
          </div>
        }
      />

      <StatGrid>
        <StatCard label={copy.statTotal} value={state.stats.total} icon={Puzzle} />
        <StatCard label={copy.statActive} value={state.stats.active} icon={Puzzle} />
        <StatCard label={copy.statDrafts} value={state.stats.drafts} icon={Puzzle} />
        <StatCard label={copy.statOwners} value={state.stats.owners} icon={LayoutGrid} />
      </StatGrid>

      {/*
        Partial and truncated reads are qualifications on the data that is on
        screen, so they stay next to it as persistent banners. A toast would
        disappear while the incomplete index remained.
      */}
      {state.failures.length > 0 && (
        <DegradedBanner>
          <p>{copy.partial}</p>
          <ul className="mt-2 space-y-1">
            {state.failures.map(failure => (
              <li key={failure.application.key} className="text-xs">
                <bdi className="font-mono">{failure.application.key}</bdi>
                {" — "}{failure.error.message}
                <span dir="ltr" className="ms-1 break-all font-mono">
                  {failure.error.errorCode} {failure.error.correlationId}
                </span>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="mt-3" loading={state.isRefreshing} onClick={state.retryFailed}>
            {copy.partialRetry}
          </Button>
        </DegradedBanner>
      )}

      {/*
        An unresolved CREATE must be recoverable from here. Reaching it only
        from inside the create dialog would make the operator guess which owner
        to reopen before the warning was even visible.
      */}
      {state.pendingCreates.map(pending => (
        <DegradedBanner key={pending.application.key}>
          <p>{copy.pendingCreateTitle}</p>
          <p className="mt-1">{copy.recovered}</p>
          <p dir="ltr" className="mt-1 break-all font-mono text-xs">
            {pending.application.key} · {pending.attempt.resource.id} · {pending.attempt.savedAt}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => state.openCreate(pending.application.key)}>
            {copy.resumeCreate}
          </Button>
        </DegradedBanner>
      ))}

      {state.ownersTruncated && <DegradedBanner>{copy.truncatedOwners}</DegradedBanner>}

      {/*
        A deep link that names an unopenable addon fails visibly. Silently
        ignoring the parameter would leave a shared link doing nothing at all.
      */}
      {state.selectedAddonUnresolved && (
        <DegradedBanner>
          <p>{copy.unresolvedAddon}</p>
          <bdi className="mt-1 block break-all font-mono text-xs" dir="ltr">{state.selectedAddonKey}</bdi>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={state.closeDetail}>
            {copy.dismissLink}
          </Button>
        </DegradedBanner>
      )}

      {state.truncatedOwners.length > 0 && (
        <DegradedBanner>
          <p>{copy.truncatedAddons}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {state.truncatedOwners.map(owner => (
              <li key={owner.key}>
                <Link href={`/applications-catalogue/${owner.key}`} className="font-mono text-xs underline">
                  <bdi dir="ltr">{owner.key}</bdi>
                </Link>
              </li>
            ))}
          </ul>
        </DegradedBanner>
      )}

      <div className="space-y-0 rounded-lg border border-border bg-card p-2 sm:p-2.5">
        <FilterBar
          labelEn="Addon filters"
          labelAr={copy.filterApplication}
          isRefreshing={state.isRefreshing}
          fields={[
            { key: "search", type: "search", labelEn: "Search", labelAr: copy.search, placeholderEn: "Search addons", placeholderAr: copy.search },
            {
              key: "app",
              type: "select",
              labelEn: "Application",
              labelAr: copy.columnApplication,
              placeholderEn: "All applications",
              placeholderAr: copy.allApplications,
              options: state.eligibleOwners.map(owner => ({ value: owner.key, labelEn: owner.name, labelAr: owner.name })),
            },
            {
              key: "lifecycle",
              type: "select",
              labelEn: "Lifecycle",
              labelAr: copy.lifecycle,
              placeholderEn: "All lifecycles",
              placeholderAr: copy.allLifecycles,
              options: [
                { value: "DRAFT", labelEn: "Draft", labelAr: copy.draft },
                { value: "ACTIVE", labelEn: "Active", labelAr: copy.activeLabel },
                { value: "DEPRECATED", labelEn: "Deprecated", labelAr: copy.deprecatedLabel },
                { value: "DISABLED", labelEn: "Disabled", labelAr: copy.disabledLabel },
              ],
            },
          ]}
          // The field keys below are also the URL parameter names FilterBar
          // writes, and the hook reads those same names back. Renaming one
          // without the other silently drops the filter from shared links.
          values={{ search: state.search, app: state.applicationKey, lifecycle: state.lifecycleStatus }}
          onChange={state.onFiltersChanged}
          onReset={state.onFiltersChanged}
        />

        {state.ownersError ? (
          <ErrorState title={copy.ownersFailed} error={state.ownersError} onRetry={state.refresh} />
        ) : (
          <DataTable
            labelEn="Addons"
            labelAr={copy.indexTitle}
            columns={columns}
            data={state.rows}
            isLoading={state.isLoading}
            isRefreshing={state.isRefreshing}
            responsiveMode="priority-columns"
            getRowId={row => row.addon.id}
            getRowLabel={row => row.addon.key}
            pagination={{
              page: state.page,
              limit: ADDONS_INDEX_PAGE_SIZE,
              totalItems: state.totalItems,
              totalPages: state.totalPages,
              onPageChange: state.setPage,
            }}
            emptyState={
              // A filtered miss and a genuinely empty catalogue are different
              // situations and need different next actions.
              state.isFiltered
                ? { titleEn: "No addon matches these filters", titleAr: copy.filteredEmpty }
                : { titleEn: "No addons yet", titleAr: copy.indexEmpty, descriptionAr: copy.systemBoundary, descriptionEn: "System and non-billable applications cannot own paid addons." }
            }
          />
        )}
      </div>

      {state.selectedAddonKey && state.selectedOwner && (
        <AddonDetailPanel
          applicationKey={state.selectedOwner.key}
          applicationName={state.selectedOwner.name}
          addonKey={state.selectedAddonKey}
          actorId={state.actorId}
          canReadTiers={state.canReadTiers}
          canUpdate={state.canUpdate}
          canCritical={state.canCritical}
          canDelete={state.canDelete}
          onClose={state.closeDetail}
          onDeleted={deleted}
        />
      )}

      {state.creating && state.canCreate && (
        <AddonCreateFlow
          owners={state.eligibleOwners}
          ownersTruncated={state.ownersTruncated}
          initialOwnerKey={state.createOwnerKey}
          actorId={state.actorId}
          copy={copy}
          onClose={state.closeCreate}
          onCreated={addonKey => { state.refresh(); state.completeCreate(addonKey); }}
        />
      )}
    </div>
  );
}

/**
 * Create is two steps because it has to be. `useAddonMutation` is keyed by the
 * owning application and `useAddonDefinitionDialog` seeds the key field from it
 * at mount, so the owner must be known before the definition dialog exists —
 * and a different owner has to produce a different dialog, not a re-rendered
 * one. Choosing an owner therefore swaps the picker for a freshly mounted
 * dialog rather than updating a prop on a live one.
 */
function AddonCreateFlow({ owners, ownersTruncated, initialOwnerKey, actorId, copy, onClose, onCreated }: {
  owners: readonly ApplicationView[];
  ownersTruncated: boolean;
  initialOwnerKey: string;
  actorId: string;
  copy: AddonCopy;
  onClose: () => void;
  onCreated: (addonKey: string) => void;
}) {
  const [picked, setPicked] = useState<ApplicationView | null>(null);
  // A resumed creation skips the picker: its owner is already decided by the
  // journal being recovered.
  const owner = picked ?? owners.find(item => item.key === initialOwnerKey) ?? null;
  if (!owner) return <AddonOwnerPicker owners={owners} truncated={ownersTruncated} copy={copy} onSelect={setPicked} onClose={onClose} />;
  return <AddonCreateDialog key={owner.key} owner={owner} actorId={actorId} copy={copy} onClose={onClose} onCreated={onCreated} />;
}

function AddonCreateDialog({ owner, actorId, copy, onClose, onCreated }: {
  owner: ApplicationView;
  actorId: string;
  copy: AddonCopy;
  onClose: () => void;
  onCreated: (addonKey: string) => void;
}) {
  const mutation = useAddonMutation(owner.key, "CREATE", actorId);
  // The dialog always calls onClose right after onAccepted. On the accepted
  // path the navigation has already been written as one atomic update, so the
  // trailing close must not issue a second, stale write over it.
  const completed = useRef(false);
  return (
    <AddonDefinitionDialog
      action="CREATE"
      applicationKey={owner.key}
      mutation={mutation}
      copy={copy}
      onAccepted={async addonKey => { completed.current = true; onCreated(addonKey); }}
      onClose={() => { if (!completed.current) onClose(); }}
    />
  );
}
