"use client";

import { Button, DateTime, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, IdentifierText, Input, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useApplicationActivationCommand, type ActivationCommandProps } from "../hooks/useApplicationActivationCommand";
import { CompanyCommandStatus } from "./CompanyCommandStatus";

export function ApplicationActivationCommand(props: ActivationCommandProps) {
  const { t, dir } = useI18n();
  const copy = t.applicationActivationCommand;
  const action = useApplicationActivationCommand(props);
  const state = action.state;
  const branch = props.request.kind === "BRANCH_OVERRIDE";
  const pending = state?.phase === "pending";
  const target = state?.command?.target ?? props.request;
  const enabled = state?.command ? "enabled" in state.command.body ? state.command.body.enabled : state.command.body.mode === "INHERIT" : state?.enabled;
  if (!action.canRead) return null;
  return <div className="min-w-0 space-y-3">
    {action.manage && <PermissionGate require={[]} denied={action.denied}>
    <section aria-label={copy.title} className="min-w-0 space-y-3 rounded-md border border-border p-4">
      <h2 className="text-sm font-medium">{copy.title}</h2>
      <p className="text-sm text-muted-foreground">{branch ? copy.branchNotice : copy.companyNotice}</p>
      {!action.ready && <p role="status" className="text-sm text-muted-foreground">{t.addonAssignmentCommand.sessionPending}</p>}
      {state?.phase === "uncertain" && <p role="alert" className="text-sm text-muted-foreground">{t.addonAssignmentCommand.uncertain}</p>}
      {state?.phase === "storage" && <p role="alert" className="text-sm text-destructive">{t.addonAssignmentCommand.storageFailed}</p>}
      {state?.phase === "rejected" && state.status?.state !== "REJECTED" && <p role="alert" className="text-sm text-muted-foreground">{copy.stale}</p>}
      {state?.refreshFailed && <p role="status" className="text-sm text-muted-foreground">{t.addonAssignmentCommand.refreshFailed}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!action.canEnable} onClick={() => action.review(true)}>{branch ? copy.inherit : copy.enable}</Button>
        <Button variant="outline" disabled={!action.canDisable} onClick={() => action.review(false)}>{branch ? copy.restrict : copy.disable}</Button>
        {state?.command && state.phase === "uncertain" && <Button variant="outline" disabled={!action.ready} onClick={action.reviewOriginal}>{t.addonAssignmentCommand.reviewOriginal}</Button>}
      </div>
      <Dialog open={action.ready && (state?.open ?? false)} onOpenChange={action.changeOpen}>
        <DialogContent dir={dir} showCloseButton={!pending} aria-busy={pending || undefined} className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{state?.command ? t.addonAssignmentCommand.reviewOriginal : copy.confirmTitle}</DialogTitle>
            <DialogDescription>{state?.command ? t.addonAssignmentCommand.retryNotice : copy.confirmNotice}</DialogDescription></DialogHeader>
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{"branchId" in target ? t.applicationAccess.branch : t.applicationAccess.company}</dt>
              <dd><IdentifierText>{"branchId" in target ? target.branchId : target.companyId}</IdentifierText></dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.application}</dt><dd><IdentifierText>{target.applicationKey}</IdentifierText></dd></div>
            {"addonKey" in target && <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.addon}</dt><dd><IdentifierText>{target.addonKey}</IdentifierText></dd></div>}
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{copy.requestedState}</dt><dd>{branch ? enabled ? copy.inherit : copy.restrict : enabled ? copy.enable : copy.disable}</dd></div>
          </dl>
          {state?.command && <p className="text-xs text-muted-foreground">{t.addonAssignmentCommand.originalKey}: <IdentifierText>{state.command.idempotencyKey}</IdentifierText></p>}
          <Field label={copy.reason} hint={t.branchAddonRestriction.reasonHint} required error={state?.invalidReason ? t.branchAddonRestriction.reasonInvalid : undefined}>
            <Input value={state?.reason ?? ""} onChange={(event) => action.changeReason(event.target.value)} maxLength={500} disabled={pending || !!state?.command || !action.ready} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => action.changeOpen(false)} disabled={pending}>{t.common.cancel}</Button>
            <Button variant={!enabled ? "destructive" : "outline"} loading={pending} disabled={!action.ready || pending} onClick={action.confirm}>
              {state?.command ? t.addonAssignmentCommand.retryOriginal : copy.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
    </PermissionGate>}
    <CompanyCommandStatus status={state?.status ?? null} canRead={action.canRead} ready={action.canReadStatus} loading={state?.statusLoading ?? false}
      error={state?.statusError ?? null} reload={action.readStatus} />
    {!action.manage && state?.phase === "uncertain" && state.command && !state.status && <p role="status" className="text-sm text-muted-foreground">{t.applicationCommandStatus.manageRequired}</p>}
    {!action.manage && state?.phase === "storage" && <p role="alert" className="text-sm text-destructive">{t.addonAssignmentCommand.storageFailed}</p>}
    {state?.receipt && <div className="space-y-2 rounded-md border border-border p-3">
      <p role="status" className="text-sm">{state.receipt.changed ? copy.applied : copy.noChange}</p>
      <p className="text-sm text-muted-foreground">{copy.historical}</p>
      <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.addonAssignmentCommand.receipt}</dt><dd><IdentifierText>{state.receipt.operationId}</IdentifierText></dd></div>
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.binding}</dt><dd><IdentifierText>{state.receipt.resourceId}</IdentifierText></dd></div>
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.revision}</dt><dd><IdentifierText>{state.receipt.resourceRevision}</IdentifierText></dd></div>
        <div><dt className="text-xs text-muted-foreground">{t.addonAssignmentCommand.completedAt}</dt><dd><DateTime value={state.receipt.completedAt} /></dd></div>
      </dl>
    </div>}
    {(action.denied || (state && ["processing", "uncertain", "rejected", "committed", "storage"].includes(state.phase))) &&
      <Button variant="outline" disabled={pending || state?.statusLoading} onClick={action.recheck}>{t.addonAssignmentCommand.recheck}</Button>}
  </div>;
}
