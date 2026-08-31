"use client";

import { useCallback, useMemo } from "react";
import {
  Contact,
  FileText,
  Package,
  Search,
  TrendingUp,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  PageHeader,
  cn,
  proseMeasure,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  SEARCH_MIN_TERM_LENGTH,
  UNSEARCHABLE_SOURCE_IDS,
  type SearchSourceId,
  type UnsearchableSourceId,
} from "../search-contract";
import { useGlobalSearch, type SearchSourceState } from "../hooks/useGlobalSearch";
import {
  MAX_EXPORT_ROWS,
  exportRowEstimate,
  previewRowCount,
  useSearchExport,
} from "../hooks/useSearchExport";
import { SearchExportControls } from "./SearchExportControls";
import { SearchSourceSection } from "./SearchSourceSection";

const SOURCE_ICONS: Record<SearchSourceId, LucideIcon> = {
  parties: Contact,
  leads: Users2,
  customerProfiles: Users,
  opportunities: TrendingUp,
};

const UNSEARCHABLE_ICONS: Record<UnsearchableSourceId, LucideIcon> = {
  items: Package,
  commercialDocuments: FileText,
};

function sourceTotal(state: SearchSourceState): number {
  return state.kind === "ready" ? state.page.total : 0;
}

export function SearchWorkspace({ initialTerm }: { initialTerm: string }) {
  const { t, lang } = useI18n();
  const copy = t.globalSearch;
  const search = useGlobalSearch(initialTerm);
  const { results, visibleSourceIds } = search;

  const count = useCallback(
    (value: number) => formatNumber(value, lang),
    [lang],
  );

  const estimate = useMemo(
    () => exportRowEstimate(results, visibleSourceIds),
    [results, visibleSourceIds],
  );
  const previewCount = useMemo(
    () => previewRowCount(results, visibleSourceIds),
    [results, visibleSourceIds],
  );

  const exportLabels = useMemo(
    () => ({
      source: copy.export.columnSource,
      title: copy.export.columnTitle,
      subtitle: copy.export.columnSubtitle,
      reference: copy.export.columnReference,
      sourceNames: {
        parties: copy.sources.parties,
        leads: copy.sources.leads,
        customerProfiles: copy.sources.customerProfiles,
        opportunities: copy.sources.opportunities,
      },
    }),
    [copy],
  );

  const exporter = useSearchExport({
    term: search.term,
    branchId: search.branchId,
    sourceIds: visibleSourceIds,
    results,
    labels: exportLabels,
    fileNameBase: copy.export.fileName,
  });

  const progressPercent =
    exporter.progress && exporter.progress.expected > 0
      ? Math.round((exporter.progress.loaded / exporter.progress.expected) * 100)
      : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        secondaryActions={
          <SearchExportControls
            labels={{
              trigger: copy.export.trigger,
              menuLabel: copy.export.menuLabel,
              previewOption: formatTemplate(copy.export.previewOption, {
                count: count(previewCount),
              }),
              allOption: formatTemplate(copy.export.allOption, {
                count: count(estimate.capped),
              }),
              capNotice:
                estimate.total > MAX_EXPORT_ROWS
                  ? formatTemplate(copy.export.capNotice, {
                      cap: count(MAX_EXPORT_ROWS),
                      total: count(estimate.total),
                    })
                  : null,
              progressLabel: copy.export.progressLabel,
              progressValueText: formatTemplate(copy.export.progressValueText, {
                loaded: count(exporter.progress?.loaded ?? 0),
                expected: count(exporter.progress?.expected ?? 0),
              }),
              cancel: t.common.cancel,
              truncatedNotice:
                exporter.truncatedAt === null
                  ? null
                  : formatTemplate(copy.export.truncated, {
                      count: count(exporter.truncatedAt),
                    }),
              failureNotice: exporter.error ? copy.export.failure : null,
              dismiss: t.common.dismiss,
              disabledReason: copy.export.nothingToExport,
            }}
            canExport={previewCount > 0}
            isExporting={exporter.isExporting}
            progressPercent={progressPercent}
            onExportPreview={exporter.exportPreview}
            onExportAll={exporter.exportAll}
            onCancel={exporter.cancel}
            onDismissNotice={exporter.dismissError}
          />
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <div className="flex grow flex-col gap-1.5">
            <Label htmlFor="global-search-term">{copy.inputLabel}</Label>
            <Input
              id="global-search-term"
              type="search"
              value={search.draft}
              placeholder={copy.inputPlaceholder}
              onChange={(event) => search.setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") search.submit();
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <TenantBranchSelect
              branchIds={search.branchIds}
              branchId={search.branchId}
              onChange={search.selectBranch}
              disabled={search.isSearching}
            />
            {/* Not `primary`: at most one filled primary button per screen and
                it belongs in PageHeader — AGENTS.md#design. */}
            <Button variant="secondary" size="md" onClick={search.submit}>
              <Search className="size-4" aria-hidden="true" />
              {copy.searchAction}
            </Button>
          </div>
        </CardContent>
      </Card>

      {search.hasSearched ? (
        <p className="text-xs text-muted-foreground">
          {formatTemplate(copy.summary, {
            count: count(search.totalMatches),
            term: search.term,
          })}
        </p>
      ) : (
        <EmptyState
          icon={Search}
          title={copy.promptTitle}
          description={formatTemplate(copy.promptDescription, {
            min: count(SEARCH_MIN_TERM_LENGTH),
          })}
        />
      )}

      {search.hasSearched
        ? visibleSourceIds.map((sourceId) => (
            <SearchSourceSection
              key={sourceId}
              sourceId={sourceId}
              icon={SOURCE_ICONS[sourceId]}
              state={results[sourceId]}
              onRetry={search.retry}
              labels={{
                name: copy.sources[sourceId],
                matches: copy.matches[sourceId],
                openList: copy.openList,
                emptyTitle: copy.emptyTitle,
                emptyDescription: copy.emptyDescription,
                deniedTitle: copy.deniedTitle,
                deniedDescription: copy.deniedDescription,
                needsBranchTitle: copy.needsBranchTitle,
                needsBranchDescription: copy.needsBranchDescription,
                errorTitle: copy.errorTitle,
                retry: t.common.retry,
                countLabel: formatTemplate(copy.count, {
                  count: count(sourceTotal(results[sourceId])),
                }),
                moreLabel: copy.more,
              }}
            />
          ))
        : null}

      <UnsearchableNotices />
    </div>
  );
}

/**
 * The two families 13.21 names that no endpoint can search.
 *
 * Stated rather than omitted: a result set that silently drops a module
 * because its endpoint ignored the term reads as "there are none", and the
 * user has no way to tell the difference. Each notice names what the endpoint
 * DOES support and links to the list where that filter lives.
 */
function UnsearchableNotices() {
  const { t } = useI18n();
  const copy = t.globalSearch;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <h2 className="text-sm font-medium text-foreground">{copy.unsearchableTitle}</h2>
        <ul className="flex flex-col gap-3">
          {UNSEARCHABLE_SOURCE_IDS.map((id) => {
            const Icon = UNSEARCHABLE_ICONS[id];
            return (
              <li key={id} className="flex items-start gap-2">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-foreground">{copy.unsearchable[id].name}</span>
                  <span className={cn("text-xs text-muted-foreground", proseMeasure)}>
                    {copy.unsearchable[id].reason}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
