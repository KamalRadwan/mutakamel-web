"use client";
import { useDesignerLayers } from "../hooks/useDesignerRibbon";
import { useScopedTableSelection } from "../hooks/useScopedTableSelection";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";
import { DesignerInteractionPanel } from "./DesignerInteractionPanel";
import type { DescriptorBoundDesignerProvider } from "../../designer-native-context";
import type { PageController } from "../../pages/page-controller";
import { DesignerPageManagementHost } from "./DesignerPageManagementHost";
import { TemplateSnapshotReview } from "./TemplateDraftRecoveryReview";
import { QuotationTextPropertiesDialog } from "./QuotationTextPropertiesDialog";
import { QuotationTableHeadersDialog } from "./QuotationTableHeadersDialog";

type Editor = ReturnType<typeof useTemplateDesignEditor>;
export function DesignerRibbon({ editor, provider, pages }: { editor: Editor; provider?: DescriptorBoundDesignerProvider; pages?: PageController }) {
  const c = editor.t.quotationPdf, d = c.designer;
  const disabled = !editor.editable || editor.hasPending || editor.localPending || editor.conflict;
  const flowInsertDisabled = disabled || !editor.flowRootInsertionAvailable;
  const salesOffer = editor.salesBinding.offer;
  const bindingDisabled = salesOffer ? disabled || !salesOffer.fields.length : flowInsertDisabled || !editor.bindingPaletteAvailable;
  const scopedInsertAvailable = editor.viewport.selectedIds.length === 1 && editor.bindingPaletteAvailable;
  const scopedTextAvailable = editor.viewport.selectedIds.length === 1 && editor.scopedTextInsertionAvailable;
  const unboundInsertDisabled = disabled || (!editor.flowRootInsertionAvailable &&
    (editor.viewport.selectedIds.length !== 1 || !editor.unboundBodyInsertionAvailable));
  const binding = <Select value="" disabled={bindingDisabled} onValueChange={path => {
    if (salesOffer) editor.salesBinding.insertField(salesOffer.pin, path);
    else editor.insertField(path);
  }}>
    <SelectTrigger className="min-w-40 max-w-64" aria-label={c.binding}><SelectValue placeholder={c.binding} /></SelectTrigger>
    <SelectContent>{(salesOffer?.fields ?? (editor.bindingPaletteAvailable ? editor.schema?.fields
      .filter(field => !field.path.includes("[]") && !["ARRAY", "OBJECT", "IMAGE"].includes(field.dataType)).map(field => field.path) : []))
      ?.map(path => <SelectItem key={path} value={path}>{path}</SelectItem>)}</SelectContent>
  </Select>;
  return <Tabs defaultValue="design" className="min-w-0 rounded-lg border border-border bg-card">
    <div className="overflow-x-auto px-3"><TabsList aria-label={d.ribbon}>
      {(["design", "insert", "variables", "tables", "formulas", "page", "history"] as const).map(tab => <TabsTrigger key={tab} value={tab}>{d[tab]}</TabsTrigger>)}
    </TabsList></div>
    <TabsContent value="design" className="flex flex-wrap items-center gap-2 p-3">
      <Button variant="outline" size="sm" disabled={!editor.canUndo} onClick={editor.undo}>{c.undo}</Button>
      <Button variant="outline" size="sm" disabled={!editor.canRedo} onClick={editor.redo}>{c.redo}</Button>
      <LayersDialog editor={editor} />
      {!provider && editor.editableQuotationText && !editor.viewport.hand && <QuotationTextPropertiesDialog
        key={`${editor.localSessionEpoch}:${editor.editableQuotationText.id}`} editor={editor} nodeId={editor.editableQuotationText.id} />}
      {(editor.canMoveUpWithinBody || editor.canMoveDownWithinBody) && <>
        <Button variant="outline" size="sm" disabled={disabled || !editor.canMoveUpWithinBody} onClick={() => editor.moveWithinBody(-1)}>{c.moveUp}</Button>
        <Button variant="outline" size="sm" disabled={disabled || !editor.canMoveDownWithinBody} onClick={() => editor.moveWithinBody(1)}>{c.moveDown}</Button>
      </>}
      <DesignerInteractionPanel editor={editor} provider={provider} />
    </TabsContent>
    <TabsContent value="insert" className="flex flex-wrap items-center gap-2 p-3">
      <Button variant="outline" size="sm" disabled={disabled || (!editor.flowRootInsertionAvailable && !scopedTextAvailable)} onClick={editor.insertText}>{c.text}</Button>
      <Button variant="outline" size="sm" disabled={unboundInsertDisabled} onClick={editor.insertDivider}>{c.divider}</Button>
      {binding}
      <Select value="" disabled={unboundInsertDisabled || !editor.assets.length} onValueChange={editor.insertImage}>
        <SelectTrigger className="min-w-40 max-w-64" aria-label={c.image}><SelectValue placeholder={c.image} /></SelectTrigger>
        <SelectContent>{editor.assets.map(asset => <SelectItem key={asset.id} value={asset.id}>{asset.originalFileName}</SelectItem>)}</SelectContent>
      </Select>
    </TabsContent>
    <TabsContent value="variables" className="flex flex-wrap items-center gap-2 p-3">{binding}</TabsContent>
    <TabsContent value="tables" className="flex flex-wrap items-center gap-2 p-3">
      {!provider && <QuotationTableHeadersDialog binding={editor.salesBinding} />}
      <ScopedTableInsertion editor={editor} disabled={disabled || (!salesOffer?.table && !scopedInsertAvailable)} />
      <Button variant="outline" size="sm" disabled={disabled || !scopedInsertAvailable || !editor.scopedTotalsInsertionAvailable} onClick={editor.insertTotals}>{c.totals}</Button>
    </TabsContent>
    <TabsContent value="formulas" className="p-3"><p role="status" className="text-sm text-muted-foreground">{d.formulaUnavailable}</p></TabsContent>
    <TabsContent value="page" className="p-3">{pages ? <DesignerPageManagementHost editor={editor} controller={pages} /> : <p role="status" className="text-sm text-muted-foreground">{d.geometry.unavailable}</p>}</TabsContent>
    <TabsContent value="history" className="p-3">{!editor.hasPending && <TemplateSnapshotReview templateId={editor.draft?.templateId ?? ""} current={editor.isCurrentAuthority} />}</TabsContent>
  </Tabs>;
}

function ScopedTableInsertion({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const salesTable = editor.salesBinding.offer?.table;
  const { copy, offer, source, columns, failed, selectSource, selectColumn, submit, canSubmit, canChooseColumn } =
    useScopedTableSelection(editor.document, salesTable ?? editor.tableOffer, disabled,
      salesTable ? editor.salesBinding.insertTable : editor.insertTable);
  return <div className="flex min-w-0 flex-col gap-2">
    {offer && <Field label={copy.source} showLabel>
      <Select value={source?.sourcePath ?? ""} onValueChange={selectSource}>
        <SelectTrigger aria-label={copy.source}><SelectValue placeholder={copy.source} /></SelectTrigger>
        <SelectContent>{offer.sources.map(item => <SelectItem key={item.sourcePath} value={item.sourcePath}>
          <bdi dir="ltr">{item.sourcePath}</bdi>
        </SelectItem>)}</SelectContent>
      </Select>
    </Field>}
    {source && <fieldset className="flex flex-wrap gap-2">
      <legend className="text-sm">{copy.columns}</legend>
      <p className="basis-full text-sm">{copy.rowKey} <bdi dir="ltr">{source.rowKeyPath}</bdi></p>
      {source.columnPaths.map(path => <label key={path} className="flex items-center gap-2 text-sm">
        <Checkbox checked={columns.includes(path)} disabled={!canChooseColumn(path)} onCheckedChange={checked => selectColumn(path, checked === true)} />
        <bdi dir="ltr">{path}</bdi>
      </label>)}
    </fieldset>}
    {failed && <p role="status" className="text-sm">{copy.refused}</p>}
    <Button type="button" variant="outline" size="sm" disabled={!canSubmit} onClick={submit}>{editor.t.quotationPdf.table}</Button>
  </div>;
}

function LayersDialog({ editor }: { editor: Editor }) {
  const { search, setSearch, nodes } = useDesignerLayers(editor);
  const c = editor.t.quotationPdf.designer;
  const disabled = !editor.editable || editor.hasPending || editor.localPending || editor.conflict;
  return <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" disabled={!editor.document}>{c.layers}</Button></DialogTrigger>
    <DialogContent size="2xl" className="max-h-[85dvh] overflow-auto">
      <DialogTitle>{c.layers}</DialogTitle><DialogDescription>{c.layersHelp}</DialogDescription>
      <Input value={search} onChange={event => setSearch(event.target.value)} aria-label={c.searchLayers} />
      <ul className="divide-y divide-border">{nodes.map(node => <li key={node.id} className="flex flex-wrap items-center gap-2 py-2">
        <Button variant="ghost" size="sm" aria-pressed={editor.selected?.id === node.id} onClick={() => editor.select(node.id)}>{node.name ?? c.unnamed}</Button>
        <Button variant="outline" size="sm" disabled={disabled} aria-pressed={node.hidden} onClick={() => editor.setNodeFlags(node.id, { hidden: !node.hidden })}>{node.hidden ? c.show : c.hide}</Button>
        <Button variant="outline" size="sm" disabled={disabled} aria-pressed={node.locked} onClick={() => editor.setNodeFlags(node.id, { locked: !node.locked })}>{node.locked ? c.unlock : c.lock}</Button>
      </li>)}</ul>
    </DialogContent>
  </Dialog>;
}
