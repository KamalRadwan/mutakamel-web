"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Field, IdentifierText, Input, PermissionGate } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useBranchAddonRestriction, type BranchAddonRestrictionProps } from "../hooks/useBranchAddonRestriction";

// Unmounted local confirmation; a future owner must supply authoritative command/recovery handling.
export function BranchAddonRestriction(props: BranchAddonRestrictionProps) {
  const { t, dir } = useI18n();
  const copy = t.branchAddonRestriction;
  const action = useBranchAddonRestriction(props);
  const { state, view } = action;
  const pending = state?.phase === "pending";
  if (!action.manage) return null;
  return <PermissionGate require={[]} denied={action.denied}>
    <div className="min-w-0 space-y-3">
      {!action.ready ? <p role="status" className="text-sm text-muted-foreground">{copy.unavailable}</p>
        : view?.resource.mode === "DISABLED" ? <p role="status" className="text-sm text-muted-foreground">{copy.alreadyDisabled}</p> : <>
          {state?.phase === "stale" && <p role="alert" className="text-sm text-muted-foreground">{copy.stale}</p>}
          {state?.phase === "uncertain" && <p role="alert" className="text-sm text-muted-foreground">{copy.uncertain}</p>}
          {state?.phase === "submitted" && <p role="status" className="text-sm text-muted-foreground">{copy.rereadNotice}</p>}
        </>}
      {view?.resource.mode !== "DISABLED" && <Dialog open={action.ready && (state?.open ?? false)} onOpenChange={action.changeOpen}>
        <DialogTrigger asChild><Button variant="outline" disabled={!action.canOpen}>{copy.review}</Button></DialogTrigger>
        <DialogContent dir={dir} showCloseButton={!pending} aria-busy={pending || undefined} className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.notice}</DialogDescription></DialogHeader>
          <p className="text-sm text-muted-foreground">{copy.provisional}</p>
          {view && <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.branch}</dt><dd><IdentifierText>{view.scope.branchId}</IdentifierText></dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.company}</dt><dd><IdentifierText>{view.scope.companyId}</IdentifierText></dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.application}</dt><dd><IdentifierText>{view.target.applicationKey}</IdentifierText></dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.addon}</dt><dd><IdentifierText>{view.target.addonKey}</IdentifierText></dd></div>
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.applicationAccess.revision}</dt><dd><IdentifierText>{view.resource.revision}</IdentifierText></dd></div>
          </dl>}
          <Field label={copy.reason} hint={copy.reasonHint} required error={state?.invalidReason ? copy.reasonInvalid : undefined}>
            <Input value={state?.reason ?? ""} onChange={action.changeReason} maxLength={500} disabled={pending || !action.ready} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => action.changeOpen(false)} disabled={pending}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={action.confirm} loading={pending} disabled={!action.canOpen}>{copy.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
      {action.ready && (state?.phase === "stale" || state?.phase === "submitted") &&
        <Button variant="outline" onClick={action.reread}>{copy.reread}</Button>}
    </div>
  </PermissionGate>;
}
