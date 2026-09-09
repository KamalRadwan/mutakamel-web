"use client";

import Link from "next/link";

import { Button, DetailSection, ErrorState, IdentifierText, PageHeader, PermissionGate, Skeleton } from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import type { ApplicationAccessRequest } from "../application-access-contract";
import { useApplicationAccess } from "../hooks/useApplicationAccess";
import { ApplicationActivationCommand } from "./ApplicationActivationCommand";
import { ConfigurationForm } from "./ConfigurationForm";

export function ApplicationAccessDetail({ request }: { request: ApplicationAccessRequest }) {
  const read = useApplicationAccess(request);
  const { t, lang, view, error, loading, denied, reload, configurationHref } = read;
  const copy = t.applicationAccess;
  const resource = view?.resource;
  return (
    <div className="flex flex-col gap-4">
    <PermissionGate require={[]} denied={denied}>
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.title} description={copy.description}
          secondaryActions={<>
            {configurationHref && <Button variant="outline" asChild><Link href={configurationHref}>{copy.configuration}</Link></Button>}
            <Button variant="outline" onClick={reload} disabled={loading}>{t.coreBilling.reload}</Button>
          </>} />
        {error ? <ErrorState title={copy.loadFailed} description={error.status === 404 ? copy.notFound : copy.unavailable}
          onRetry={reload} retryLabel={t.common.retry} /> : loading || !view || !resource ? (
          <div role="status" aria-label={copy.loading} aria-busy="true" className="flex flex-col gap-3">
            <Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" />
          </div>
        ) : <>
          <DetailSection title={copy.scope} emptyValueLabel={t.detail.notRecorded} fields={[
            { label: copy.application, value: <IdentifierText>{view.target.applicationKey}</IdentifierText> },
            { label: copy.addon, value: view.target.addonKey && <IdentifierText>{view.target.addonKey}</IdentifierText> },
            { label: copy.company, value: <IdentifierText>{view.scope.companyId}</IdentifierText> },
            { label: copy.branch, value: view.scope.branchId && <IdentifierText>{view.scope.branchId}</IdentifierText> },
          ]} />
          <DetailSection title={copy.binding} description={copy.notOperational} fields={[
            { label: copy.state, value: copy.status[resource.kind === "CONFIGURATION" ? resource.bindingState : resource.state] },
            { label: copy.revision, value: <IdentifierText>{resource.revision}</IdentifierText> },
            ...(resource.kind === "CONFIGURATION"
              ? [{ label: copy.configuration, value: copy.status[resource.configurationState] }]
              : resource.kind === "BRANCH_OVERRIDE"
                ? [{ label: copy.override, value: resource.mode ? copy.status[resource.mode] : copy.status.NOT_CREATED },
                  { label: copy.companyApplication, value: resource.companyApplicationEnabled ? t.filters.yes : t.filters.no },
                  { label: copy.companyAddon, value: resource.companyAddonEnabled ? t.filters.yes : t.filters.no }]
                : [{ label: copy.enabled, value: resource.enabled === null ? copy.status.NOT_CREATED : resource.enabled ? t.filters.yes : t.filters.no }]),
          ]} />
          {resource.kind === "CONFIGURATION" && resource.currentVersion && <DetailSection title={t.applicationConfiguration.record} description={t.applicationConfiguration.safeRead} fields={[
            { label: t.applicationConfiguration.versionId, value: <IdentifierText>{resource.currentVersion.id}</IdentifierText> },
            { label: t.applicationConfiguration.historyRevision, value: <IdentifierText>{resource.currentVersion.revision}</IdentifierText> },
            { label: copy.definition, value: <IdentifierText>{resource.currentVersion.definitionVersionId}</IdentifierText> },
            { label: t.applicationConfiguration.schemaKey, value: <IdentifierText>{resource.currentVersion.schemaRef.key}</IdentifierText> },
            { label: t.applicationConfiguration.schemaVersion, value: formatNumber(resource.currentVersion.schemaRef.version, lang) },
          ]} />}
          <DetailSection title={copy.source} emptyValueLabel={t.detail.notRecorded} fields={[
            { label: copy.selection, value: copy.status[view.source.selectionState] },
            { label: copy.applicationLifecycle, value: view.source.applicationLifecycleStatus && copy.status[view.source.applicationLifecycleStatus] },
            { label: copy.addonLifecycle, value: view.source.addonLifecycleStatus && copy.status[view.source.addonLifecycleStatus] },
            { label: copy.definition, value: copy.status[view.source.definitionState] },
            { label: copy.localSource, value: copy.status[view.source.localSourceState] },
            { label: copy.adoption, value: view.source.adoptionPending ? t.filters.yes : t.filters.no },
            { label: copy.observed, value: formatDateTime(view.source.observedAt, lang) },
          ]} />
        </>}
      </div>
    </PermissionGate>
    <ApplicationActivationCommand request={request} read={read} />
    {(request.kind === "COMPANY_CONFIGURATION" || request.kind === "BRANCH_CONFIGURATION") && <ConfigurationForm request={request} read={read} />}
    </div>
  );
}
