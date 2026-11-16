"use client";

import Link from "next/link";
import { ChevronsDownUp, ChevronsUpDown, Layers, RefreshCw, Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PermissionGate,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { ORG_TREE_NODE_LIMIT_PER_LEVEL } from "../contracts/organization-contract";
import { useCoreErrorText } from "../hooks/useCoreErrorText";
import { OrganizationQuickViewDialog } from "./components/OrganizationQuickViewDialog";
import { OrganizationTreeNodes } from "./components/OrganizationTreeNodes";
import { useOrganizationTree } from "./hooks/useOrganizationTree";

export default function OrganizationTreePage() {
  const { t } = useI18n();
  const lang = useLanguage();
  const copy = t.coreIdentity.tree;
  const describeError = useCoreErrorText();
  const tree = useOrganizationTree();

  return (
    <PermissionGate require="org.company.read" denied={tree.loadError?.status === 403}>
      <div className="flex min-w-0 flex-col gap-3 px-2 pb-4 pt-0 sm:px-5 sm:pb-5">
        <PageHeader
          className="sr-only p-0"
          title={copy.title}
          secondaryActions={
            <Button size="sm" variant="outline" onClick={tree.reload} disabled={tree.isLoading}>
              <RefreshCw
                className={`size-4 ${tree.isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t.coreIdentity.actions.refresh}
            </Button>
          }
        />

        {tree.isTooLarge ? (
          // Not an error: the request succeeded and the server refused to build
          // an unbounded payload. Retrying cannot change that, so this offers
          // the paginated screens instead of a retry button.
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <Layers className="size-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-foreground">{copy.tooLargeTitle}</p>
              </div>
              <p className="max-w-prose text-xs text-muted-foreground">
                {formatTemplate(copy.tooLargeDescription, {
                  limit: formatNumber(ORG_TREE_NODE_LIMIT_PER_LEVEL, lang),
                })}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreCompanies}>
                    {t.coreIdentity.levels.companies.title}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreBranches}>
                    {t.coreIdentity.levels.branches.title}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreDepartments}>
                    {t.coreIdentity.levels.departments.title}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreTeams}>
                    {t.coreIdentity.levels.teams.title}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : tree.loadError ? (
          <ErrorState
            title={copy.loadFailed}
            description={describeError(tree.loadError)}
            onRetry={tree.reload}
            retryLabel={t.common.retry}
          />
        ) : tree.isLoading ? (
          <div className="flex flex-col gap-2" role="status" aria-busy="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-11/12" />
            <Skeleton className="h-9 w-10/12" />
          </div>
        ) : tree.roots.length === 0 ? (
          <div className="flex flex-col items-center">
            <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
            <Button variant="outline" size="sm" asChild>
              <Link href={TENANT_ROUTES.coreCompanies}>
                {t.coreIdentity.levels.companies.title}
              </Link>
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="relative min-w-56 flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    size="sm"
                    type="search"
                    value={tree.searchQuery}
                    onChange={(event) => tree.setSearchQuery(event.target.value)}
                    placeholder={t.common.search}
                    aria-label={t.common.search}
                    className="ps-8"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-2xs text-muted-foreground">
                    {formatTemplate(copy.nodeCount, {
                      count: formatNumber(tree.visibleCount, lang),
                    })}
                  </span>
                  <Button variant="outline" size="xs" onClick={tree.expandAll}>
                    <ChevronsUpDown className="size-3.5" aria-hidden="true" />
                    {t.audit.expandAll}
                  </Button>
                  <Button variant="outline" size="xs" onClick={tree.collapseAll}>
                    <ChevronsDownUp className="size-3.5" aria-hidden="true" />
                    {t.audit.collapseAll}
                  </Button>
                </div>
              </div>

              {tree.visibleRoots.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <p className="text-xs text-muted-foreground">{t.coreIdentity.picker.empty}</p>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => tree.setSearchQuery("")}
                  >
                    {t.filters.clearAll}
                  </Button>
                </div>
              ) : (
                <div role="tree" aria-label={copy.title}>
                  <OrganizationTreeNodes
                    nodes={tree.visibleRoots}
                    depth={0}
                    expandedIds={tree.expandedIds}
                    onToggle={tree.toggleExpanded}
                    onQuickView={tree.openQuickView}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <OrganizationQuickViewDialog
          target={tree.quickViewTarget}
          onClose={tree.closeQuickView}
        />
      </div>
    </PermissionGate>
  );
}
