"use client";

import { Button, DateTime, DetailSection, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  ErrorState, Field, IdentifierText, Input, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { useConfigurationForm, type ConfigurationFormProps } from "../hooks/useConfigurationForm";
import { ConfigurationFields } from "./ConfigurationFields";
import { CompanyCommandStatus } from "./CompanyCommandStatus";

export function ConfigurationForm(props: ConfigurationFormProps) {
  const { t, dir, lang } = useI18n();
  const copy = t.applicationConfiguration;
  const action = useConfigurationForm(props), state = action.state;
  const pending = state?.phase === "pending";
  const command = state?.command;
  if (!action.canRead) return null;
  return <div className="min-w-0 space-y-3">
    {action.manage && <PermissionGate require={[]} denied={action.denied}>
      <section aria-label={copy.title} className="min-w-0 space-y-4 rounded-md border border-border p-4">
        <h2 className="text-sm font-medium">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.replaceNotice}</p>
        <p className="text-xs text-muted-foreground">{props.request.kind === "BRANCH_CONFIGURATION" ? copy.branchNotice : copy.companyNotice}</p>
        {action.input.loading && <Skeleton className="h-32 w-full" />}
        {action.input.error && <ErrorState title={copy.unavailable} description={copy.unavailableDescription} onRetry={action.recheck} retryLabel={t.common.retry} />}
        {action.ready && action.input.view && props.read.view && !action.fresh && !props.read.loading && !action.input.loading
          && <p role="status" className="text-sm text-muted-foreground">{copy.stale}</p>}
        {!action.ready && <p role="status" className="text-sm text-muted-foreground">{t.addonAssignmentCommand.sessionPending}</p>}
        {state?.phase === "uncertain" && <p role="alert" className="text-sm text-muted-foreground">{t.addonAssignmentCommand.uncertain}</p>}
        {state?.phase === "restore" && <p role="status" className="text-sm text-muted-foreground">{copy.restoreNotice}</p>}
        {state?.restoreMismatch && <p role="alert" className="text-sm text-destructive">{copy.restoreMismatch}</p>}
        {state?.phase === "storage" && <p role="alert" className="text-sm text-destructive">{t.addonAssignmentCommand.storageFailed}</p>}
        {state?.phase === "rejected" && state.status?.state !== "REJECTED" && <p role="alert" className="text-sm text-muted-foreground">{copy.stale}</p>}
        {state?.refreshFailed && <p role="status" className="text-sm text-muted-foreground">{t.addonAssignmentCommand.refreshFailed}</p>}
        {action.input.view && ((action.fresh && state?.phase === "editing") || (action.restoreReady && state?.phase === "restore")) && state && <>
          <ConfigurationFields node={action.input.view.inputSchema} draft={state.draft} path={[]} required action={action} />
          <Field label={copy.reason} hint={t.branchAddonRestriction.reasonHint} required error={state.invalidReason ? t.branchAddonRestriction.reasonInvalid : undefined}>
            <Input value={state.reason} onChange={(event) => action.changeReason(event.target.value)} maxLength={500} disabled={!action.editable} />
          </Field>
          <Button variant="outline" disabled={!action.editable} onClick={action.review}>{state.phase === "restore" ? copy.verifyOriginal : copy.review}</Button>
        </>}
        {command && state?.phase === "uncertain" && <Button variant="outline" disabled={!action.ready} onClick={action.reviewOriginal}>{t.addonAssignmentCommand.reviewOriginal}</Button>}
      </section>
      <Dialog open={action.ready && (state?.open ?? false)} onOpenChange={action.changeOpen}>
        <DialogContent dir={dir} showCloseButton={!pending} aria-busy={pending || undefined} className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{copy.review}</DialogTitle><DialogDescription>{state?.phase === "uncertain" ? copy.retryNotice : copy.replaceNotice}</DialogDescription></DialogHeader>
          {command && <DetailSection title={copy.exactTarget} fields={[
            { label: "companyId" in command.target ? t.applicationAccess.company : t.applicationAccess.branch,
              value: <IdentifierText>{"companyId" in command.target ? command.target.companyId : command.target.branchId}</IdentifierText> },
            { label: t.applicationAccess.addon, value: <IdentifierText>{command.target.addonKey}</IdentifierText> },
            { label: t.applicationAccess.definition, value: <IdentifierText>{command.body.definitionVersionId}</IdentifierText> },
            { label: copy.schemaKey, value: <IdentifierText>{command.body.schemaRef.key}</IdentifierText> },
            { label: copy.schemaVersion, value: formatNumber(command.body.schemaRef.version, lang) },
            { label: t.applicationAccess.revision, value: <IdentifierText>{command.body.expectedConfigRevision}</IdentifierText> },
            { label: t.addonAssignmentCommand.originalKey, value: <IdentifierText>{command.idempotencyKey}</IdentifierText> },
            { label: copy.reason, value: command.body.reason },
          ]} />}
          {state?.phase === "review" && action.input.view && <ConfigurationFields node={action.input.view.inputSchema} draft={state.draft} path={[]} required action={action} review />}
          <DialogFooter><Button variant="outline" disabled={pending} onClick={() => action.changeOpen(false)}>{t.common.cancel}</Button>
            <Button variant="outline" loading={pending} disabled={!action.ready || pending} onClick={action.confirm}>{copy.confirm}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGate>}
    <CompanyCommandStatus status={state?.status ?? null} canRead={action.canRead} ready={action.canReadStatus} loading={state?.statusLoading ?? false}
      error={state?.statusError ?? null} reload={action.readStatus} />
    {!action.manage && state?.intent && !state.status && <p role="status" className="text-sm text-muted-foreground">{t.applicationCommandStatus.manageRequired}</p>}
    {!action.manage && state?.phase === "storage" && <p role="alert" className="text-sm text-destructive">{t.addonAssignmentCommand.storageFailed}</p>}
    {state?.receipt && <DetailSection title={state.receipt.changed ? copy.saved : copy.noChange} description={copy.historical} fields={[
      { label: t.addonAssignmentCommand.receipt, value: <IdentifierText>{state.receipt.operationId}</IdentifierText> },
      { label: t.applicationAccess.binding, value: <IdentifierText>{state.receipt.resourceId}</IdentifierText> },
      { label: t.applicationAccess.revision, value: <IdentifierText>{state.receipt.resourceRevision}</IdentifierText> },
      { label: t.addonAssignmentCommand.completedAt, value: <DateTime value={state.receipt.completedAt} /> },
    ]} />}
    {(action.denied || (state && ["restore", "processing", "uncertain", "rejected", "committed", "storage"].includes(state.phase))) &&
      <Button variant="outline" disabled={pending || state?.statusLoading} onClick={action.recheck}>{t.addonAssignmentCommand.recheck}</Button>}
  </div>;
}
