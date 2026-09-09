"use client";

import { Button, DateTime, DetailSection, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Field, IdentifierText, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useDefinitionAdoptionCart } from "../hooks/useDefinitionAdoptionCart";
import type { useDefinitionAdoptionDiscovery } from "../hooks/useDefinitionAdoptionDiscovery";
import type { useCommercialChange } from "../hooks/useCommercialChange";
import { CommercialChangeList } from "./CommercialChangeList";

export function DefinitionAdoptionEditor({ discovery, change }: {
  discovery: ReturnType<typeof useDefinitionAdoptionDiscovery>; change: ReturnType<typeof useCommercialChange>;
}) {
  const { t, dir } = useI18n();
  const copy = t.commercialAdoption, form = useDefinitionAdoptionCart(discovery, change);
  const state = discovery.state, selection = state?.selected;
  return <div className="flex min-w-0 flex-col gap-4">
    <section className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-4" aria-label={copy.selections}>
      <h2 className="text-sm font-semibold">{copy.selections}</h2><p className="text-xs text-muted-foreground">{copy.discoveryNotice}</p>
      {state?.selections && (state.selections.items.length === 0 ? <EmptyState title={copy.noSelections} /> : <>
        <Field label={copy.chooseSelection}><Select value={selection?.addonSelectionId ?? ""} onValueChange={(id) => void discovery.select(id)} disabled={!form.enabled}>
          <SelectTrigger><SelectValue placeholder={copy.chooseSelection} /></SelectTrigger><SelectContent>
            {state.selections.items.map((row) => <SelectItem key={row.addonSelectionId} value={row.addonSelectionId}>
              {row.applicationKey} · {row.addonKey} · {row.addonSelectionId}
            </SelectItem>)}
          </SelectContent></Select></Field>
        {state.selections.nextCursor && <div><Button variant="outline" disabled={!form.enabled} onClick={() => void discovery.nextSelections()}>{copy.nextSelections}</Button></div>}
      </>)}
      {selection && <DetailSection title={copy.current} emptyValueLabel={t.detail.notRecorded} fields={[
        { label: copy.addon, value: selection.addonKey },
        { label: t.commercialReceipt.selection, value: <IdentifierText>{selection.addonSelectionId}</IdentifierText> },
        { label: copy.current, value: <IdentifierText>{selection.currentDefinition.definitionVersionId}</IdentifierText> },
        { label: copy.version, value: <IdentifierText>{selection.currentDefinition.version}</IdentifierText> },
        { label: copy.revoked, value: selection.currentDefinition.revokedAt && <DateTime value={selection.currentDefinition.revokedAt} /> },
      ]} />}
    </section>
    {state?.targets && <section className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-4" aria-label={copy.targets}>
      <h2 className="text-sm font-semibold">{copy.targets}</h2>
      {state.targets.items.length === 0 && <EmptyState title={copy.noTargets} />}
      {state.targets.items.map((target) => <div key={target.targetDefinitionVersionId} className="flex min-w-0 flex-col gap-2 border-b border-border pb-3">
        <DetailSection title={copy.version} fields={[
          { label: copy.version, value: <IdentifierText>{target.version}</IdentifierText> },
          { label: t.commercialPurchase.definition, value: <IdentifierText>{target.targetDefinitionVersionId}</IdentifierText> },
          { label: copy.published, value: <DateTime value={target.publishedAt} /> },
        ]} />
        <div><Button variant="outline" disabled={!form.enabled || form.cart.rows.length >= 100
          || form.cart.rows.some((row) => row.selection.addonSelectionId === selection?.addonSelectionId)} onClick={() => form.add(target.targetDefinitionVersionId)}>{copy.add}</Button></div>
      </div>)}
      {state.targets.nextCursor && <div><Button variant="outline" disabled={!form.enabled} onClick={() => void discovery.nextTargets()}>{copy.nextTargets}</Button></div>}
    </section>}
    <section className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-4" aria-label={copy.draft}>
      <h2 className="text-sm font-semibold">{copy.draft}</h2>
      {form.cart.rows.length === 0 && <p className="text-xs text-muted-foreground">{copy.emptyDraft}</p>}
      {form.cart.rows.map((row) => <div key={row.selectionKey} className="flex min-w-0 flex-col gap-2 border-b border-border pb-3">
        <DetailSection title={row.selection.addonKey} fields={[
          { label: t.commercialReceipt.selection, value: <IdentifierText>{row.selection.addonSelectionId}</IdentifierText> },
          { label: copy.current, value: <IdentifierText>{row.selection.currentDefinition.definitionVersionId}</IdentifierText> },
          { label: t.commercialPurchase.definition, value: <IdentifierText>{row.target.targetDefinitionVersionId}</IdentifierText> },
        ]} /><div><Button variant="ghost" disabled={!form.enabled} onClick={() => form.remove(row.selectionKey)}>{t.commercialPurchase.removeDraft}</Button></div>
      </div>)}
      <Field label={t.commercialPurchase.reason}><Textarea maxLength={256} value={form.cart.reason} disabled={!form.enabled}
        onChange={(event) => form.reason(event.target.value)} /></Field>
      {form.invalid && <p role="alert" className="text-sm text-destructive">{copy.invalid}</p>}
      <div><Button variant="outline" disabled={!form.enabled || form.cart.rows.length === 0} onClick={form.prepareReview}>{copy.review}</Button></div>
    </section>
    <Dialog open={!!form.review} onOpenChange={form.close}><DialogContent dir={dir} className="max-h-[85dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{copy.review}</DialogTitle><DialogDescription>{copy.prepareNotice}</DialogDescription></DialogHeader>
      {form.review && <><CommercialChangeList request={form.review.request} /><p className="text-xs text-muted-foreground">{copy.noWallet}</p></>}
      <DialogFooter><Button variant="outline" onClick={form.close}>{t.common.cancel}</Button>
        <Button variant="outline" disabled={!form.enabled} onClick={() => void form.confirm()}>{copy.prepare}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
