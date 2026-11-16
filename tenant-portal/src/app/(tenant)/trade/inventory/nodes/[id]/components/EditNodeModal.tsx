"use client";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, FormModal } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { toNodeForm, type InventoryNodeDetail, type NodeFormValues } from "../../../inventory-contract";
import { NodeFormFields } from "../../components/NodeFormFields";
import { useNodeForm } from "../../hooks/useNodeForm";
interface Props { node: InventoryNodeDetail; draft?: NodeFormValues; isOpen: boolean; onClose: () => void; onSubmit: (values: NodeFormValues) => Promise<boolean>; isSubmitting: boolean; error: string | null; unresolved: boolean; onRetryOriginal: () => Promise<boolean>; canRetryOriginal: boolean }
export function EditNodeModal({ node, draft, isOpen, onClose, onSubmit, isSubmitting, error, unresolved, onRetryOriginal, canRetryOriginal }: Props) {
  const { t } = useI18n();
  const form = useNodeForm(draft ?? toNodeForm(node), onSubmit, node);
  const inv = t.tradeInventory;
  return <>
    <FormModal open={isOpen && !form.reviewOpen} onOpenChange={(open) => { if (!open) onClose(); }} size="wide"
      title={`${inv.nodeEditTitle} — ${node.name}`} description={inv.nodeEditDescription} isDirty={form.isDirty}
      isSubmitting={isSubmitting} onSubmit={() => void form.submit()} error={error ?? form.error ?? undefined}
      submitDisabled={unresolved} footerLeading={unresolved ? <div className="flex flex-col gap-2"><p role="status" className="text-caption text-muted-foreground">{inv.governanceUnknownWrite}</p><Button variant="outline" disabled={!canRetryOriginal || isSubmitting} onClick={() => void onRetryOriginal()}>{inv.governanceRetryOriginal}</Button></div> : undefined}
      labels={{ submit: t.common.save, cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel, sections: inv.nodeEditTitle, sectionInvalid: t.common.cancel }}>
      <NodeFormFields values={form.values} errors={form.fieldErrors} onChange={form.patch} isSubmitting={isSubmitting || unresolved} isEdit />
    </FormModal>
    <Dialog open={isOpen && form.reviewOpen} onOpenChange={(open) => { if (!open && !isSubmitting && !unresolved) form.closeReview(); }}><DialogContent size="xl" closeLabel={t.common.close} showCloseButton={!isSubmitting && !unresolved}
      onEscapeKeyDown={(event) => { if (isSubmitting || unresolved) event.preventDefault(); }} onPointerDownOutside={(event) => { if (isSubmitting || unresolved) event.preventDefault(); }}>
      <DialogTitle>{inv.nodeDeactivateTitle}</DialogTitle><DialogDescription>{inv.nodeDeactivateImpact}</DialogDescription>
      <p className="rounded-md border border-border bg-muted p-3 text-sm">{node.name} · <bdi>{node.code}</bdi></p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {unresolved ? <p role="status" className="text-sm text-muted-foreground">{inv.governanceUnknownWrite}</p> : null}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={form.closeReview} disabled={isSubmitting || unresolved}>{t.common.back}</Button><Button onClick={() => void (unresolved ? onRetryOriginal() : form.submit(true))} disabled={isSubmitting || (unresolved && !canRetryOriginal)}>{unresolved ? inv.governanceRetryOriginal : inv.nodeDeactivateConfirm}</Button></div>
    </DialogContent></Dialog>
  </>;
}
