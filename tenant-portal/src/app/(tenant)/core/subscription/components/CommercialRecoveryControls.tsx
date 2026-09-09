"use client";

import { Button, DetailSection, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, IdentifierText, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { useCommercialChange } from "../hooks/useCommercialChange";
import { useCommercialRecoveryReview } from "../hooks/useCommercialRecoveryReview";

export function CommercialRecoveryControls({ change }: { change: ReturnType<typeof useCommercialChange> }) {
  const { t, dir } = useI18n();
  const copy = t.commercialPurchase;
  const form = useCommercialRecoveryReview(change);
  return <section className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-4" aria-label={copy.recovery}>
    <h2 className="text-sm font-semibold">{copy.recovery}</h2>
    <p className="text-xs text-muted-foreground">{copy.recoveryNotice}</p>
    <Field label={copy.recoveryReason}><Textarea maxLength={256} value={form.reason}
      onChange={(event) => form.setReason(event.target.value)} disabled={!change.canRecover} /></Field>
    {form.invalid && <p role="alert" className="text-sm text-destructive">{copy.invalidReason}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!change.canRecover} onClick={() => form.choose("RECONCILE")}>{copy.status.RECONCILE}</Button>
      <Button variant="outline" disabled={!change.canRecover} onClick={() => form.choose("CANCEL_PREPARATION")}>{copy.status.CANCEL_PREPARATION}</Button>
    </div>
    <Dialog open={!!form.review} onOpenChange={form.close}>
      <DialogContent dir={dir} className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{copy.reviewRecovery}</DialogTitle><DialogDescription>{copy.recoveryNotice}</DialogDescription></DialogHeader>
        {form.review && <DetailSection title={copy.request} fields={[
          { label: t.commercialOperation.operation, value: <IdentifierText>{form.review.operationId}</IdentifierText> },
          { label: t.commercialOperation.revision, value: <IdentifierText>{form.review.request.expectedOperationRevision}</IdentifierText> },
          { label: t.commercialReceipt.change, value: copy.status[form.review.request.action] },
          { label: copy.recoveryReason, value: form.review.request.reason },
        ]} />}
        <DialogFooter><Button variant="outline" onClick={form.close}>{t.common.cancel}</Button><Button variant="outline" disabled={!change.canRecover} onClick={() => void form.confirm()}>{copy.confirmRecovery}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
