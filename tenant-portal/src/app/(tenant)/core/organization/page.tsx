"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CORE_IDENTITY_NAV_ITEMS,
  EmptyState,
  ErrorState,
  PageHeader,
  PermissionGate,
  Skeleton,
  SubNav,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { ORG_TREE_NODE_LIMIT_PER_LEVEL } from "../contracts/organization-contract";
import { useCoreErrorText } from "../hooks/useCoreErrorText";
import { OrganizationTreeNodes } from "./components/OrganizationTreeNodes";
import { countTreeNodes, useOrganizationTree } from "./hooks/useOrganizationTree";

export default function OrganizationTreePage() {
  const { t } = useI18n();
  const lang = useLanguage();
  const copy = t.coreIdentity.tree;
  const describeError = useCoreErrorText();
  const { roots, expandedIds, toggleExpanded, isLoading, loadError, isTooLarge, reload } =
    useOrganizationTree();

  return (
    <PermissionGate require="org.company.read">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={copy.title}
          description={copy.subtitle}
          secondaryActions={
            <Button variant="outline" onClick={reload} disabled={isLoading}>
              <RefreshCw
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t.common.retry}
            </Button>
          }
        />

        <SubNav items={CORE_IDENTITY_NAV_ITEMS} />

        {isTooLarge ? (
          // Not an error: the request succeeded and the server refused to build
          // an unbounded payload. Retrying cannot change that, so this offers
          // the paginated screens instead of a retry button.
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm font-medium text-foreground">{copy.tooLargeTitle}</p>
              <p className="max-w-prose text-xs text-muted-foreground">
                {formatTemplate(copy.tooLargeDescription, {
                  limit: formatNumber(ORG_TREE_NODE_LIMIT_PER_LEVEL, lang),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreCompanies}>{t.coreIdentity.levels.companies.title}</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreBranches}>{t.coreIdentity.levels.branches.title}</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreDepartments}>{t.coreIdentity.levels.departments.title}</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={TENANT_ROUTES.coreTeams}>{t.coreIdentity.levels.teams.title}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : loadError ? (
          <ErrorState
            title={copy.loadFailed}
            description={describeError(loadError)}
            onRetry={reload}
            retryLabel={t.common.retry}
          />
        ) : isLoading ? (
          <div className="flex flex-col gap-2" role="status" aria-busy="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-11/12" />
            <Skeleton className="h-9 w-10/12" />
          </div>
        ) : roots.length === 0 ? (
          <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
        ) : (
          <Card>
            <CardContent className="py-3">
              <p className="pb-2 text-2xs text-muted-foreground">
                {formatTemplate(copy.nodeCount, {
                  count: formatNumber(countTreeNodes(roots), lang),
                })}
              </p>
              <div role="tree" aria-label={copy.title}>
                <OrganizationTreeNodes
                  nodes={roots}
                  depth={0}
                  expandedIds={expandedIds}
                  onToggle={toggleExpanded}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PermissionGate>
  );
}
