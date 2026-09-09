"use client";

import { Button, DateTime, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, IdentifierText, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { AddonAssignmentSource } from "../application-addon-assignment-intent";
import { useAddonAssignmentCommand } from "../hooks/useAddonAssignmentCommand";

// Prepared reusable row action. No workspace/route imports it before root's write release.
export function AddonAssignmentCommand({ userId, source, onReload }: {
  userId: string; source: AddonAssignmentSource; onReload: () => void | Promise<void>;
}) {
  const { t, dir } = useI18n();
  const copy = t.addonAssignmentCommand;
  const action = useAddonAssignmentCommand(userId, source, onReload);
  const state = action.state;
  const command = state?.command ?? state?.draft ?? action.draft;
  const isRemoval = command?.operationKind === "UNASSIGN_ADDON";
  const pending = state?.phase === "submitting";
  const uncertain = state?.phase === "uncertain";
  return <div className="min-w-0 space-y-3">
    <PermissionGate require={[]} denied={action.denied}>
      {!action.ready ? <p role="status" className="text-sm text-muted-foreground">{copy.sessionPending}</p> : <>
        {!command && !action.loading && <p className="text-xs text-muted-foreground">{source.kind === "RECOVERY" ? copy.noRetained : copy.requiredParent}</p>}
        {state?.phase === "storage" && <p role="alert" className="text-sm text-destructive">{copy.storageFailed}</p>}
        {state?.phase === "rejected" && <p role="alert" className="text-sm text-muted-foreground">{copy.stale}</p>}
        {uncertain && !state.open && <p role="status" className="text-sm text-muted-foreground">{copy.uncertain}</p>}
        {state?.receipt && <section aria-label={copy.receipt} className="space-y-2 rounded-md border border-border p-3">
          <p role="status" className="text-sm">{state.receipt.changed
            ? state.receipt.operationKind === "ASSIGN_ADDON" ? copy.assigned : copy.removed : copy.noChange}</p>
          <p className="text-xs text-muted-foreground">{copy.historical}</p>
          <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{copy.receipt}</dt><dd><IdentifierText>{state.receipt.operationId}</IdentifierText></dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.addonAssignments.assignment}</dt><dd><IdentifierText>{state.receipt.resourceId}</IdentifierText></dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.addonAssignments.generation}</dt><dd><IdentifierText>{state.receipt.resourceRevision}</IdentifierText></dd></div>
            <div><dt className="text-xs text-muted-foreground">{copy.completedAt}</dt><dd><DateTime value={state.receipt.completedAt} /></dd></div>
          </dl>
        </section>}
        {state?.refreshFailed && <p role="alert" className="text-sm text-muted-foreground">{copy.refreshFailed}</p>}
        <Dialog open={state?.open ?? false} onOpenChange={action.close}>
          <DialogTrigger asChild><Button variant="outline" onClick={action.open} disabled={!action.canOpen}>
            {state?.command ? copy.reviewOriginal : isRemoval ? copy.remove : copy.assign}
          </Button></DialogTrigger>
          <DialogContent dir={dir} showCloseButton={!pending} aria-busy={pending || undefined} className="max-h-[85dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>{isRemoval ? copy.remove : copy.assign}</DialogTitle>
              <DialogDescription>{isRemoval ? copy.removeNotice : copy.assignNotice}</DialogDescription></DialogHeader>
            <dl className="grid min-w-0 gap-3">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.addonAssignments.user}</dt><dd><IdentifierText>{userId}</IdentifierText></dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">{source.kind === "RECOVERY" ? t.addonAssignmentOptions.selection : t.applicationAccess.addon}</dt><dd><IdentifierText>{source.kind === "RECOVERY" ? source.row.addonSelectionId : source.row.addonKey}</IdentifierText></dd></div>
              {command?.operationKind === "UNASSIGN_ADDON" && <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.addonAssignments.assignment}</dt><dd><IdentifierText>{command.assignmentId}</IdentifierText></dd></div>}
              {command && <div><dt className="text-xs text-muted-foreground">{t.addonAssignments.allowance}</dt><dd><IdentifierText>{command.operationKind === "ASSIGN_ADDON" ? command.body.expectedAllowanceRevision : command.query.expectedAllowanceRevision}</IdentifierText></dd></div>}
            </dl>
            {state?.command && <div className="min-w-0 text-xs"><span>{copy.originalKey}: </span><IdentifierText>{state.command.idempotencyKey}</IdentifierText></div>}
            {(uncertain || state?.error) && <div role="alert" className="space-y-2 text-sm">
              <p>{copy.uncertain}</p>
              {state?.error && <p>{errorDescription(state.error.status, state.error.code, copy)}</p>}
            </div>}
            {state?.phase === "storage" && <p role="alert" className="text-sm text-destructive">{copy.storageFailed}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => action.close()} disabled={pending}>{t.common.close}</Button>
              <Button variant={isRemoval ? "destructive" : "outline"} loading={pending} onClick={action.confirm}
                disabled={!action.ready || state?.phase === "storage"}>{uncertain ? copy.retryOriginal : isRemoval ? copy.confirmRemove : copy.confirmAssign}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>}
    </PermissionGate>
    {(action.denied || state?.phase === "rejected" || state?.phase === "committed" || state?.phase === "storage") &&
      <Button variant="outline" onClick={action.recheck} disabled={pending}>{copy.recheck}</Button>}
  </div>;
}

function errorDescription(status: number, code: string | undefined, copy: ReturnType<typeof useI18n>["t"]["addonAssignmentCommand"]): string {
  if (status === 401) return copy.authRequired;
  if (status === 409 && code === "ADDON_ASSIGNMENT_REVISION_STALE") return copy.staleOriginal;
  if (status === 409 && code === "APPLICATION_ALLOWANCE_NOT_READY") return copy.notReady;
  if (status === 422 && code === "SEAT_LIMIT_REACHED") return copy.capacity;
  if (status === 422 && code === "IDEMPOTENCY_BODY_MISMATCH") return copy.mismatch;
  if (status === 404 && code === "ASSIGNMENT_NOT_FOUND") return copy.notFound;
  return copy.retryNotice;
}
