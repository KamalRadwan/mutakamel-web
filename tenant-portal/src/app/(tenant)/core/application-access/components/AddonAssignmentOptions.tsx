"use client";

import type { ReactNode } from "react";
import { ListChecks } from "lucide-react";
import { Button, DetailSection, EmptyState, ErrorState, IdentifierText, PageHeader, Pagination, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useBillingTableLabels } from "../../billing/hooks/useBillingTableLabels";
import type { ApplicationAddonAssignmentOption } from "../application-addon-assignment-options";
import { useAddonAssignmentOptions } from "../hooks/useAddonAssignmentOptions";
import { AddonSeatCommandPanel } from "./AddonSeatCommandPanel";

export function AddonAssignmentOptions({ userId }: { userId: string }) {
  const { t } = useI18n();
  const copy = t.addonAssignmentOptions;
  const read = useAddonAssignmentOptions(userId);
  const labels = useBillingTableLabels(copy.loadFailed, copy.empty);
  return <PermissionGate require={[]} denied={read.denied}>
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={copy.title} description={copy.description} secondaryActions={
        <Button variant="outline" onClick={read.reload} disabled={read.loading}>{t.coreBilling.reload}</Button>
      } />
      <DetailSection title={t.addonAssignments.user} fields={[{ label: t.addonAssignments.user, value: <IdentifierText>{userId}</IdentifierText> }]} />
      <p className="text-sm text-muted-foreground">{copy.notice}</p>
      {read.loading && <Skeleton className="h-64 w-full" />}
      {read.error && <ErrorState title={copy.loadFailed} description={copy.unavailable} onRetry={read.reload} retryLabel={t.common.retry} />}
      {read.data && <>
        {read.data.items.length ? <ul className="flex min-w-0 flex-col gap-3">
          {read.data.items.map((row) => <li key={row.allowanceId}><OptionCard row={row} /></li>)}
        </ul> : <EmptyState icon={ListChecks} title={copy.empty} description={copy.emptyDescription} />}
        <Pagination page={read.data.meta} onPageChange={read.changePage} labels={labels.pagination} />
      </>}
      <AddonSeatCommandPanel kind="OPTIONS" userId={userId} read={read} />
    </div>
  </PermissionGate>;
}

function OptionCard({ row }: { row: ApplicationAddonAssignmentOption }) {
  const { t } = useI18n();
  const copy = t.addonAssignmentOptions;
  const flag = (value: boolean) => value ? copy.yes : copy.no;
  return <section className="min-w-0 space-y-3 rounded-md border border-border p-4">
    <h2 className="text-sm font-medium"><IdentifierText>{row.addonKey}</IdentifierText></h2>
    <dl className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Fact label={t.applicationAccess.application}><IdentifierText>{row.applicationKey}</IdentifierText></Fact>
      <Fact label={copy.targetActive}>{flag(row.targetActive)}</Fact>
      <Fact label={copy.parentReadiness}>{copy.status[row.localState.parentReadiness]}</Fact>
      <Fact label={copy.addonReadiness}>{copy.status[row.localState.addonReadiness]}</Fact>
      <Fact label={copy.parentDenied}>{flag(row.localState.parentDenied)}</Fact>
      <Fact label={copy.addonDenied}>{flag(row.localState.addonDenied)}</Fact>
      <Fact label={copy.adoptionPending}>{flag(row.localState.adoptionPending)}</Fact>
      <Fact label={copy.capacityChangePending}>{flag(row.localState.capacityChangePending)}</Fact>
      <Fact label={copy.parentPin}><Pin value={row.parentAssignment} /></Fact>
      <Fact label={copy.childPin}><Pin value={row.assignment} /></Fact>
    </dl>
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring">{copy.sourcePins}</summary>
      <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <Fact label={copy.applicationId}><IdentifierText>{row.applicationId}</IdentifierText></Fact>
        <Fact label={copy.addonId}><IdentifierText>{row.addonId}</IdentifierText></Fact>
        <Fact label={copy.allowance}><IdentifierText>{row.allowanceId}</IdentifierText></Fact>
        <Fact label={t.addonAssignments.allowance}><IdentifierText>{row.allowanceRevision}</IdentifierText></Fact>
        <Fact label={copy.selection}><IdentifierText>{row.addonSelectionId}</IdentifierText></Fact>
        <Fact label={t.addonAssignments.definition}><IdentifierText>{row.selectedDefinitionVersionId}</IdentifierText></Fact>
      </dl>
    </details>
  </section>;
}

function Pin({ value }: { value: ApplicationAddonAssignmentOption["parentAssignment"] }) {
  const { t } = useI18n();
  return value === null ? <span>{t.addonAssignmentOptions.absent}</span> : <span className="flex min-w-0 flex-col gap-1">
    <IdentifierText>{value.id}</IdentifierText>
    <span>{t.addonAssignmentOptions.revision}: <IdentifierText>{value.revision}</IdentifierText></span>
  </span>;
}
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-normal">{children}</dd></div>;
}
