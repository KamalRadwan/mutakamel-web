"use client";

import Link from "next/link";
import { Button, DataTable, DateTime, DetailSection, ErrorState, IdentifierText, PageHeader, PermissionGate, type ColumnDef } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import type { ApplicationAddonAssignment } from "../application-addon-assignments";
import { useAddonAssignments } from "../hooks/useAddonAssignments";
import { AddonSeatCommandPanel } from "./AddonSeatCommandPanel";

export function AddonAssignments({ userId }: { userId: string }) {
  const read = useAddonAssignments(userId);
  const { t, data, loading, denied, error, reload, changePage, canBrowseUsers, labels } = read;
  const copy = t.addonAssignments;
  const columns: ColumnDef<ApplicationAddonAssignment>[] = [
    { id: "application", header: t.applicationAccess.application, cell: (row) => <IdentifierText>{row.applicationKey}</IdentifierText> },
    { id: "addon", header: t.applicationAccess.addon, cell: (row) => <IdentifierText>{row.addonKey}</IdentifierText> },
    { id: "revision", header: copy.generation, cell: (row) => <IdentifierText>{row.assignmentRevision}</IdentifierText> },
    { id: "definition", header: copy.definition, cell: (row) => <IdentifierText>{row.selectedDefinitionVersionId}</IdentifierText> },
    { id: "parent", header: copy.parent, cell: (row) => <IdentifierText>{row.parentAssignmentId}</IdentifierText> },
    { id: "assigned", header: copy.assignedAt, cell: (row) => <DateTime value={row.assignedAt} /> },
  ];
  return <PermissionGate require={[]} denied={denied}>
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} description={copy.description} secondaryActions={<>
        <Button variant="outline" asChild><Link href={TENANT_ROUTES.coreAddonSeats}>{copy.own}</Link></Button>
        {canBrowseUsers && <Button variant="outline" asChild><Link href={TENANT_ROUTES.coreUsers}>{copy.browseUsers}</Link></Button>}
        <Button variant="outline" onClick={reload} disabled={loading}>{t.coreBilling.reload}</Button>
      </>} />
      <DetailSection title={copy.user} fields={[{ label: copy.user, value: <IdentifierText>{userId}</IdentifierText> }]} />
      <p className="text-sm text-muted-foreground">{copy.notice}</p>
      <p className="text-xs text-muted-foreground">{copy.scopeNotice}</p>
      {error ? <ErrorState title={copy.loadFailed} description={copy.unavailable} onRetry={reload} retryLabel={t.common.retry} />
        : <DataTable columns={columns} rows={data?.items ?? []} isLoading={loading} rowKey={(row) => row.assignmentId}
          page={data?.meta} onPageChange={changePage} labels={labels} />}
      <AddonSeatCommandPanel kind="ASSIGNMENTS" userId={userId} read={read} />
    </div>
  </PermissionGate>;
}
