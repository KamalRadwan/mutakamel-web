"use client";
import { useId, useLayoutEffect } from "react";
import type { DesignerInteractionExit } from "../../designer-interaction-exit";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { absoluteFrame } from "../../designer-geometry-commands";
import type { GestureKind, Point, ViewportMapping } from "../../designer-interaction-contract";
import { currentNativeDesignerDocument, isDescriptorBoundDesignerProvider, type DescriptorBoundDesignerProvider } from "../../designer-native-context";
import { DesignerInspectorHost } from "./DesignerInspectorHost";
import type { DesignerInteractionController } from "../../designer-interaction-controller";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
import { useDesignerInteractions } from "../hooks/useDesignerInteractions";
import { DesignerSelectionDialog, DesignerDestinationDialog } from "./DesignerSelectionDialogs";
import { useDesignerGeometryDialog, useDesignerGeometryForm } from "../hooks/useDesignerGeometryForm";
import { QuotationImageReplacement } from "./QuotationImageReplacement";
import { QuotationImageUpload } from "./QuotationImageUpload";

export type DesignerInteractionEditor = ReturnType<typeof useTemplateDesignEditor>;
type Editor = DesignerInteractionEditor;
export interface DesignerHandleLayerProps {
  readonly interactionExit: DesignerInteractionExit;
  readonly nodeIds: readonly string[]; readonly disabled: boolean; readonly onSelect: (ids: readonly string[]) => boolean;
  readonly onBegin: (kind: GestureKind, point: Point, view: ViewportMapping, snap?: boolean) => number | null;
  readonly onUpdate: (token: number, point: Point, view: ViewportMapping) => boolean;
  readonly onCommit: (token: number) => boolean; readonly onCancel: (token: number) => void;
}
/** Supplied only by the separately qualified lazy Moveable/native browser package adoption. */
export type DesignerInteractionProvider = DescriptorBoundDesignerProvider;
export function DesignerInteractionPanel({ editor, provider }: { editor: Editor; provider?: DesignerInteractionProvider }) {
  const c = editor.t.quotationPdf.designer.geometry;
  const qualified = isDescriptorBoundDesignerProvider(provider);
  useLayoutEffect(() => {
    if (qualified) return;
    const offModel = editor.interactionExit.declareModelMount(false), offPointer = editor.interactionExit.declarePointerMount(false);
    return () => { offModel(); offPointer(); };
  }, [editor.interactionExit, qualified]);
  if (!qualified) return <>
    {editor.quotationImageUpload && <QuotationImageUpload upload={editor.quotationImageUpload} />}
    <QuotationImageReplacement editor={editor} />
    <p role="status" className="text-xs text-muted-foreground">{c.unavailable}</p>
  </>;
  return <InteractionControls key={provider.bindingKey} editor={editor} provider={provider} />;
}
function InteractionControls({ editor, provider }: { editor: Editor; provider: DesignerInteractionProvider }) {
  const { state, controller, keyboard, providerCurrent, nudgeEligible } = useDesignerInteractions(editor.interactionBridge, provider.native, editor.interactionExit);
  const keyboardHelpId = useId();
  const { lang } = useI18n(), c = editor.t.quotationPdf.designer.geometry;
  const count = new Intl.NumberFormat({ ar: "ar-EG-u-nu-latn", en: "en-US" }[lang]).format(state.selectedIds.length);
  const disabled = !providerCurrent || !editor.editable || editor.hasPending || editor.localPending || editor.conflict || !state.selectedIds.length || state.active;
  const nudgeDisabled = disabled || editor.gestureActive || editor.viewport.hand || !nudgeEligible;
  const Handles = provider.Handles;
  useLayoutEffect(() => editor.interactionExit.declarePointerMount(!!Handles), [editor.interactionExit, Handles]);
  const admitted = editor.document ? currentNativeDesignerDocument(provider, editor.document) : null;
  if (!admitted) return <p role="status" className="text-xs text-muted-foreground">{c.unavailable}</p>;
  const direction = provider.native.resolveTemplateTextDirection(editor.document!.direction === "LTR" ? "LTR" : editor.document!.direction === "RTL" ? "RTL" : "AUTO", String(editor.document!.locale));
  return <section tabIndex={0} aria-label={c.arrange} aria-describedby={keyboardHelpId} onKeyDown={keyboard} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <p className="text-xs text-muted-foreground">{formatTemplate(c.selectedCount, { count })}</p>
    <DesignerSelectionDialog editor={editor} controller={controller} selectedIds={state.selectedIds} />
    <DesignerInspectorHost editor={editor} provider={provider} controller={controller} />
    <GeometryDialog editor={editor} controller={controller} selectedIds={state.selectedIds} disabled={disabled} error={state.error !== null} />
    {(["start", "center", "end", "top", "middle", "bottom", "horizontal", "vertical"] as const).map(action => <Button key={action} variant="outline" size="sm" disabled={disabled || state.selectedIds.length < (action === "horizontal" || action === "vertical" ? 3 : 2)} onClick={() => controller.arrange(action, direction)}>{c[action]}</Button>)}
    <Button variant="outline" size="sm" disabled={nudgeDisabled} onClick={() => controller.nudge({ x: -1, y: 0 })}>{c.moveLeft}</Button>
    <Button variant="outline" size="sm" disabled={nudgeDisabled} onClick={() => controller.nudge({ x: 1, y: 0 })}>{c.moveRight}</Button>
    <Button variant="outline" size="sm" disabled={nudgeDisabled} onClick={() => controller.nudge({ x: 0, y: -1 })}>{c.moveUp}</Button>
    <Button variant="outline" size="sm" disabled={nudgeDisabled} onClick={() => controller.nudge({ x: 0, y: 1 })}>{c.moveDown}</Button>
    <Button variant="outline" size="sm" disabled={disabled || state.selectedIds.length < 2} onClick={controller.group}>{c.group}</Button>
    <Button variant="outline" size="sm" disabled={disabled || state.selectedIds.length !== 1} onClick={controller.ungroup}>{c.ungroup}</Button>
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => controller.layer(1)}>{c.forward}</Button>
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => controller.layer(-1)}>{c.backward}</Button>
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => controller.flags({ hidden: true })}>{c.hide}</Button>
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => controller.flags({ locked: true })}>{c.lock}</Button>
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => controller.flags({ locked: false, hidden: false })}>{c.unlockShow}</Button>
    <Button variant="outline" size="sm" disabled={!providerCurrent || !state.selectedIds.length} onClick={controller.copy}>{c.copy}</Button>
    <Button variant="outline" size="sm" disabled={disabled} onClick={controller.cut}>{c.cut}</Button>
    <DesignerDestinationDialog editor={editor} controller={controller} operation="move" disabled={disabled} />
    <DesignerDestinationDialog editor={editor} controller={controller} operation="paste" disabled={!providerCurrent || !editor.editable || editor.hasPending || editor.conflict || state.active} />
    {state.error && <p role="alert" className="w-full text-xs text-destructive">{c.refused}</p>}
    {state.repairAvailable && <Button variant="outline" size="sm" disabled={!editor.editable || editor.hasPending || editor.conflict} onClick={controller.repair}>{c.fitWithin}</Button>}
    {state.active && !state.error && <Button variant="outline" size="sm" onClick={controller.commitCurrent}>{c.applyGesture}</Button>}
    {state.active && <Button variant="outline" size="sm" onClick={() => controller.cancel()}>{c.cancelGesture}</Button>}
    <p id={keyboardHelpId} className="w-full text-xs text-muted-foreground">{c.keyboardHelp}</p>
    {Handles && providerCurrent ? <Handles interactionExit={editor.interactionExit} onSelect={controller.select} nodeIds={state.selectedIds} disabled={!editor.editable || editor.hasPending || editor.conflict} onBegin={controller.begin} onUpdate={controller.update} onCommit={controller.commit} onCancel={controller.cancel} /> : <p role="status" className="w-full text-xs text-muted-foreground">{c.pointerUnavailable}</p>}
  </section>;
}
function GeometryDialog({ editor, controller, selectedIds, disabled, error }: { editor: Editor; controller: DesignerInteractionController; selectedIds: readonly string[]; disabled: boolean; error: boolean }) {
  const dialog = useDesignerGeometryDialog(), c = editor.t.quotationPdf.designer.geometry;
  const selected = selectedIds.length === 1 ? editor.document?.nodes[selectedIds[0]] : null;
  return <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
    <DialogTrigger asChild><Button variant="outline" size="sm" disabled={disabled || !selected || selected.layout.kind !== "ABSOLUTE"}>{c.sizePosition}</Button></DialogTrigger>
    <DialogContent size="2xl"><DialogTitle>{c.sizePosition}</DialogTitle><DialogDescription>{c.boundsHelp}</DialogDescription>
      {error && <p role="alert" className="text-sm text-destructive">{c.refused}</p>}
      {dialog.open && selected?.layout.kind === "ABSOLUTE" && <GeometryForm key={selected.id} initial={absoluteFrame(selected)} controller={controller} applied={dialog.close} disabled={disabled} copy={c} />}
    </DialogContent>
  </Dialog>;
}
function GeometryForm({ initial, controller, applied, disabled, copy }: { initial: ReturnType<typeof absoluteFrame>; controller: DesignerInteractionController; applied: () => void; disabled: boolean; copy: Editor["t"]["quotationPdf"]["designer"]["geometry"] }) {
  const form = useDesignerGeometryForm(initial, controller, applied);
  return <form onSubmit={form.submit} className="space-y-3"><fieldset disabled={disabled} className="grid grid-cols-2 gap-3">
    {(["x", "y", "width", "height", "rotationDeg"] as const).map(key => <Field key={key} label={copy[key]} showLabel>
      <Input type="number" step={key === "rotationDeg" ? 1 : 0.001} min={key === "rotationDeg" ? -180 : key === "width" || key === "height" ? 0.001 : 0} max={key === "rotationDeg" ? 180 : key === "x" || key === "width" ? 500 : 1000} value={form.values[key]} onChange={form.change(key)} required />
    </Field>)}
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.aspect} onCheckedChange={form.setAspect} />{copy.aspect}</label>
    <Button variant="outline" type="submit">{copy.apply}</Button>
  </fieldset></form>;
}
