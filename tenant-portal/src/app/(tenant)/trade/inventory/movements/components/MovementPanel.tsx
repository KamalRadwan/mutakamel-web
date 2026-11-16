"use client";
import { PackageCheck, Plus, Truck } from "lucide-react";
import { Button, Field, FormModal, Input, NameSelect } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { MOVEMENT_LINES_MAX, type MovementFormValues, type SessionMovementEntry } from "../movements-contract";
import { useDocumentMovementDraft } from "../hooks/useDocumentMovementDraft";
import { useMovementModalLabels, type MovementReferences } from "../hooks/useMovementWorkspace";
import { MovementSourcePicker } from "./MovementSourcePicker";
import { DocumentMovementLine } from "./DocumentMovementLine";
import { MovementRetry } from "./MovementRetry";

export function MovementPanel({ isDelivery, onSubmit, pending, error, refs, headers, canReadSource, sessionEntries, onClose, retry }: {
  isDelivery: boolean; onSubmit: (values: MovementFormValues) => Promise<boolean>; pending: boolean; error: string | null;
  refs: MovementReferences; headers: Record<string, string>; canReadSource: boolean;
  sessionEntries: SessionMovementEntry[]; onClose: (completed?: boolean) => void;
  retry?: () => Promise<boolean>;
}) {
  const { t } = useI18n();
  const draft = useDocumentMovementDraft(refs, headers, isDelivery, canReadSource);
  const labels = useMovementModalLabels(t.tradeInventory.movementCreateDraft);
  const title = isDelivery ? t.tradeInventory.submitDelivery : t.tradeInventory.submitReceipt;
  const Icon = isDelivery ? Truck : PackageCheck;
  return <FormModal open onOpenChange={open => { if (!open) onClose(); }} size="wide" title={title}
    description={t.tradeInventory.movementDraftHint} headerIcon={<Icon className="size-5" aria-hidden="true" />}
    labels={labels} isDirty={draft.dirty} isSubmitting={pending} error={error ?? draft.error ?? undefined}
    footerLeading={<MovementRetry retry={retry} pending={pending} onComplete={onClose} />}
    submitDisabled={!canReadSource || draft.loading || draft.sources.loading || !refs.canNodes}
    onSubmit={() => { if (draft.validate()) void onSubmit(draft.submission()).then(saved => { if (saved) onClose(true); }); }}>
    <MovementSourcePicker sources={draft.sources} isPurchase={!isDelivery} disabled={pending || !canReadSource} onSelect={draft.selectSource} error={draft.fieldErrors.sourceDocumentId} />
    {!canReadSource && <p className="text-sm text-muted-foreground">{t.tradeInventory.movementSourcePermission}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t.tradeInventory.movementNode} showLabel required error={draft.fieldErrors.nodeId}>
        <NameSelect value={draft.values.nodeId || undefined} options={refs.nodes.filter(node => node.status === "ACTIVE").map(node => ({ value: node.id, label: `${node.name} · ${node.code}` }))}
          placeholder={t.tradeInventory.movementChooseNode} disabled={pending || !refs.canNodes} onValueChange={nodeId => draft.set({ nodeId })} />
      </Field>
      <Field label={t.tradeInventory.businessEffectiveAt} showLabel required error={draft.fieldErrors.businessEffectiveAt}>
        <Input type="datetime-local" value={draft.values.businessEffectiveAt} disabled={pending} onChange={event => draft.set({ businessEffectiveAt: event.target.value })} />
      </Field>
    </div>
    {draft.values.lines.map((line, index) => <DocumentMovementLine key={`${index}-${line.sourceLineId}`} draft={draft} index={index}
      refs={refs} disabled={pending} isDelivery={isDelivery} reservations={sessionEntries} />)}
    <Button type="button" size="sm" variant="outline" disabled={pending || !draft.sources.source || draft.values.lines.length >= MOVEMENT_LINES_MAX} onClick={draft.add}>
      <Plus className="size-4" aria-hidden="true" />{t.tradeInventory.addLine}
    </Button>
    <p className="text-sm text-muted-foreground">{t.tradeInventory.movementDraftHint}</p>
  </FormModal>;
}
