"use client";

import Link from "next/link";
import { Button, DataTable, DetailSection, ErrorState, IdentifierText, PageHeader, PermissionGate, type ColumnDef } from "@/design-system";
import type { ApplicationAccessListItem } from "../application-access-list";
import { useApplicationAccessList } from "../hooks/useApplicationAccessList";

export function ApplicationAccessList({ scope, scopeId }: { scope: "COMPANY" | "BRANCH"; scopeId: string }) {
  const { t, data, loading, denied, error, reload, changePage, labels } = useApplicationAccessList({ scope, scopeId });
  const copy = t.applicationAccess;
  const columns: ColumnDef<ApplicationAccessListItem>[] = [
    { id: "application", header: copy.application, cell: (item) => <IdentifierText>{item.target.applicationKey}</IdentifierText> },
    { id: "addon", header: copy.addon, cell: (item) => item.target.addonKey ? <IdentifierText>{item.target.addonKey}</IdentifierText> : copy.baseApplication },
    { id: "state", header: copy.state, cell: (item) => copy.status[item.resource.state] },
    { id: "enabled", header: copy.enabled, cell: (item) => item.resource.kind === "BRANCH_OVERRIDE"
      ? item.resource.mode ? copy.status[item.resource.mode] : copy.status.NOT_CREATED
      : item.resource.enabled === null ? copy.status.NOT_CREATED : item.resource.enabled ? t.filters.yes : t.filters.no },
    { id: "details", header: t.common.actions, cell: (item) => scope === "BRANCH" && item.resource.kind === "APPLICATION_ACTIVATION"
      ? <span className="text-xs text-muted-foreground">{copy.inheritedBase}</span>
      : <Button variant="ghost" size="sm" asChild><Link href={detailHref(item)}>{copy.viewDetails}</Link></Button> },
  ];
  return <PermissionGate require={[]} denied={denied}>
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} description={copy.directoryNotice}
        secondaryActions={<><Button variant="outline" asChild><Link href="/core/application-access">{copy.changeScope}</Link></Button>
          <Button variant="outline" onClick={reload} disabled={loading}>{t.coreBilling.reload}</Button></>} />
      <DetailSection title={copy.scope} fields={[{ label: scope === "COMPANY" ? copy.company : copy.branch, value: <IdentifierText>{scopeId}</IdentifierText> }]} />
      {error ? <ErrorState title={copy.loadFailed} description={copy.unavailable} onRetry={reload} retryLabel={t.common.retry} />
        : <DataTable columns={columns} rows={data?.items ?? []} rowKey={(item) => `${item.target.applicationId}:${item.target.addonId ?? "base"}`}
          isLoading={loading} page={data?.meta} onPageChange={changePage} labels={labels} />}
    </div>
  </PermissionGate>;
}

function detailHref(item: ApplicationAccessListItem): string {
  const scope = item.scope.kind === "COMPANY" ? `companies/${item.scope.companyId}` : `branches/${item.scope.branchId}`;
  return `/core/application-access/${scope}/application-activations/${item.target.applicationKey}${item.target.addonKey ? `/addons/${item.target.addonKey}` : ""}`;
}
