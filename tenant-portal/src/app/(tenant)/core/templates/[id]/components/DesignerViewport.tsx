"use client";
import { TEMPLATE_LIMITS } from "@mutakamel/template-schema/browser-safe";
import { useId, useState } from "react";
import { Button, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import type { PageConfig } from "../../pages/page-contract";
import { useDesignerViewport } from "../hooks/useDesignerViewport";
import { canInsertFixedQuotationText, insertFixedQuotationText } from "../hooks/fixedQuotationInsertion";
import { fixedQuotationDirections, useFixedQuotationPosition } from "../hooks/useFixedQuotationPosition";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
import { DesignerCanvasAdapter } from "./DesignerCanvasAdapter";
import { FixedQuotationFrameDialog } from "./FixedQuotationFrameDialog";

type ViewportEditor = Parameters<typeof useDesignerViewport>[0] & Pick<ReturnType<typeof useTemplateDesignEditor>,
  "editable" | "hasPending" | "localPending" | "conflict" | "gestureActive" | "nativeSource" |
  "editableQuotationText" | "updateQuotationText" | "selected" | "assets" | "select"> & {
    t: Pick<ReturnType<typeof useTemplateDesignEditor>["t"], "quotationPdf">;
  };

export function DesignerViewport({ editor, layoutMode, activePage }: { editor: ViewportEditor; layoutMode: string; activePage?: PageConfig | null }) {
  const ordinaryFixed = layoutMode === "FIXED_CANVAS" && !editor.nativeSource;
  const selectionEnabled = editor.editable && !editor.hasPending && !editor.localPending && !editor.conflict;
  const { frame, view, percent, fit, keys, pointerDown, pointerMove, pointerUp, pointerCancel, clickCapture, dragRejected } =
    useDesignerViewport(editor, activePage, ordinaryFixed && selectionEnabled);
  const c = editor.t.quotationPdf.designer;
  const positionHelpId = useId();
  const canSelect = !view.hand && selectionEnabled;
  const canEditOrdinaryFixed = ordinaryFixed && canSelect;
  const fixedDocument = canEditOrdinaryFixed ? editor.commandStore.getSnapshot().document : null;
  const position = useFixedQuotationPosition(editor.interactionBridge, canEditOrdinaryFixed ? editor.document : null,
    view.selectedIds, editor.interactionExit.ticket, editor.gestureActive);
  return <section className="min-w-0 space-y-2" aria-label={c.viewport}>
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
      <Button variant="outline" size="sm" onClick={() => fit(true)} disabled={!(activePage ?? editor.document?.page)}>{c.fitPage}</Button>
      <Button variant="outline" size="sm" onClick={() => fit(false)} disabled={!(activePage ?? editor.document?.page)}>{c.fitWidth}</Button>
      <Select value={String(view.zoom)} onValueChange={value => editor.setViewport({ zoom: Number(value) })}>
        <SelectTrigger className="w-28" aria-label={c.zoom}><SelectValue>{percent.format(view.zoom)}</SelectValue></SelectTrigger>
        <SelectContent>{[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <SelectItem key={value} value={String(value)}>{percent.format(value)}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant={view.hand ? "secondary" : "outline"} size="sm" aria-pressed={view.hand} onClick={() => editor.setViewport({ hand: !view.hand })}>{c.hand}</Button>
      <Button variant="ghost" size="sm" onClick={() => editor.setViewport({ zoom: 1, panX: 0, panY: 0 })}>{c.resetView}</Button>
      {fixedDocument && canInsertFixedQuotationText(fixedDocument, view.selectedIds) &&
        <FixedQuotationTextButton key={editor.interactionExit.ticket.generation} editor={editor}
          document={fixedDocument} selection={view.selectedIds} disabled={editor.gestureActive} />}
      <p className="text-xs text-muted-foreground">{c.viewOnly}</p>
    </div>
    {canSelect && editor.editableQuotationText && <Field label={editor.t.quotationPdf.text} showLabel>
      <Textarea value={String(editor.editableQuotationText.props.text)} maxLength={TEMPLATE_LIMITS.maxTextCharsPerNode} disabled={editor.gestureActive}
        onChange={event => editor.updateQuotationText(event.target.value)} />
    </Field>}
    {position.available && <div role="group" aria-label={c.geometry.arrange} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
      {fixedQuotationDirections.map(direction => <Button key={direction.key} type="button" variant="outline" size="sm" disabled={editor.gestureActive}
        onClick={() => position.move(direction)}>{c.geometry[direction.label]}</Button>)}
      <p id={positionHelpId} className="w-full text-xs text-muted-foreground">{c.geometry.keyboardHelp}</p>
    </div>}
    <FixedQuotationFrameDialog position={position} copy={c.geometry} disabled={editor.gestureActive} />
    <div ref={frame} tabIndex={0} aria-label={c.canvas} aria-describedby={position.available ? positionHelpId : undefined}
      className="min-h-[520px] min-w-0 overflow-auto rounded-lg border border-border bg-muted p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ touchAction: view.hand ? "none" : "auto" }} onKeyDown={event => { position.keyboard(event); keys(event); }}
      onClickCapture={clickCapture} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onLostPointerCapture={pointerCancel}>
      <div className="origin-top" style={{ transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }}>
        {editor.document && <DesignerCanvasAdapter layoutMode={layoutMode} ordinaryFixed={ordinaryFixed}
          document={editor.document} selectedId={view.hand ? undefined : editor.selected?.id}
          assets={editor.assets}
          select={canSelect ? editor.select : undefined}
          label={c.structure} unavailableLabel={c.nativeUnavailable} />}
      </div>
    </div>
    {(position.rejected || dragRejected) && <p role="status" className="text-xs text-destructive">{c.geometry.refused}</p>}
  </section>;
}

function FixedQuotationTextButton({ editor, document, selection, disabled }: {
  editor: ViewportEditor; document: NonNullable<ViewportEditor["document"]>; selection: readonly string[]; disabled: boolean;
}) {
  const copy = editor.t.quotationPdf;
  const [failed, setFailed] = useState<typeof document | null>(null);
  const insert = () => {
    const target = { ...editor.interactionExit.ticket, document, selection };
    setFailed(insertFixedQuotationText(editor.interactionBridge, target, copy.text) ? null : document);
  };
  return <>
    <Button type="button" variant="outline" size="sm" onClick={insert} disabled={disabled}>{copy.text}</Button>
    {failed === document && <p role="status" className="text-xs text-destructive">{copy.designer.geometry.refused}</p>}
  </>;
}
